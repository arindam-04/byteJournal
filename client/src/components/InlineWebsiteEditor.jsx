import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Eye, GripVertical, Save } from 'lucide-react';
import { api } from '../api';

const isTextOverrideMap = value => value && typeof value === 'object' && !Array.isArray(value);
const sitePanelSelector='#root,#root *';
const elementStyleProperties=['fontSize','fontFamily','fontWeight','fontStyle','color','backgroundColor','alignment','textAlign','offsetX','offsetY','positionTouched','hoverColor','hoverBackgroundColor','afterContent','afterColor','afterBackgroundColor','afterFontSize'];
const elementFontFamilyValues={system:'system-ui, sans-serif',manrope:'Manrope, sans-serif',serif:'Georgia, serif',inter:'Inter, sans-serif',mono:'DM Mono, monospace'};

function applyElementStyleOverrides(element,style={},original={}) {
  if(!element) return;
  element.style.fontSize=style.fontSize?`${style.fontSize}px`:original.fontSize||'';
  element.style.fontFamily=style.fontFamily?elementFontFamilyValues[style.fontFamily]||original.fontFamily||'':original.fontFamily||'';
  element.style.fontWeight=style.fontWeight||original.fontWeight||'';
  element.style.fontStyle=style.fontStyle||original.fontStyle||'';
  element.style.color=style.color||original.color||'';
  element.style.backgroundColor=style.backgroundColor||original.backgroundColor||'';
  element.style.textAlign=style.textAlign||original.textAlign||'';
  if(style.alignment==='center'){element.style.marginLeft='auto';element.style.marginRight='auto';}
  else if(style.alignment==='right'){element.style.marginLeft='auto';element.style.marginRight='0px';}
  else if(style.alignment==='left'){element.style.marginLeft='0px';element.style.marginRight='auto';}
  else {element.style.marginLeft=original.marginLeft||'';element.style.marginRight=original.marginRight||'';}
  const headerAction=element.matches('.bj-header-actions>.bj-write-button');
  const usePosition= !headerAction || Boolean(style.positionTouched);
  const offsetX=usePosition?Number(style.offsetX)||0:0;
  const offsetY=usePosition?Number(style.offsetY)||0:0;
  element.style.translate=offsetX||offsetY?`${offsetX}px ${offsetY}px`:original.translate||'';
  element.style.setProperty('--bj-hover-color',style.hoverColor||'');
  element.style.setProperty('--bj-hover-background',style.hoverBackgroundColor||'');
  element.style.setProperty('--bj-after-color',style.afterColor||'');
  element.style.setProperty('--bj-after-background',style.afterBackgroundColor||'');
  element.style.setProperty('--bj-after-font-size',style.afterFontSize?`${style.afterFontSize}px`:'');
  if(style.hoverColor) element.dataset.bjHoverColor='true';
  else delete element.dataset.bjHoverColor;
  if(style.hoverBackgroundColor) element.dataset.bjHoverBackground='true';
  else delete element.dataset.bjHoverBackground;
  if(style.afterContent) {element.dataset.bjAfterContent=style.afterContent;element.dataset.bjAfterStyle='true';}
  else {delete element.dataset.bjAfterContent;delete element.dataset.bjAfterStyle;}
}

function WebsitePanelList({panels=[],editing=false,onRemove=()=>{}}) {
  if(!panels.length) return null;
  return <section className="bj-custom-panel-list" aria-label="Additional website panels">
    {panels.map(panel=><article className="bj-custom-panel" data-bj-panel-id={panel.id} key={panel.id}>
      {editing&&<button type="button" className="bj-custom-panel-drag" data-bj-inline-ui="true" draggable="true" aria-label={`Drag ${panel.title||'panel'} onto the page to position it`} onDragStart={event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',panel.id);event.dataTransfer.setData('application/x-bytejournal-panel',panel.id);}}><GripVertical size={15}/> Drag to place</button>}
      <h2>{panel.title||'New panel'}</h2>
      <p>{panel.body||'Click this text to add content.'}</p>
      {editing&&<button type="button" data-bj-inline-ui="true" onClick={()=>onRemove(panel.id)}>Remove panel</button>}
    </article>)}
  </section>;
}

function getElementPath(element) {
  const parts=[];
  let current=element;
  while(current && current !== document.body) {
    const parent=current.parentElement;
    if(!parent) break;
    const siblings=[...parent.children].filter(child=>child.tagName===current.tagName&&!child.hasAttribute('data-bj-panel-host'));
    parts.unshift(current.dataset?.bjPanelId?`${current.tagName.toLowerCase()}#${current.dataset.bjPanelId}`:`${current.tagName.toLowerCase()}${siblings.indexOf(current)}`);
    current=parent;
  }
  return parts.join('/');
}

function findElementByPath(path) {
  let current=document.body;
  for(const part of String(path||'').split('/')) {
    const match=part.match(/^([a-z0-9-]+)(?:(?:#)(.+)|(\d+))$/i);
    if(!match||!current) return null;
    const [,tagName,panelId,indexText]=match;
    const siblings=[...current.children].filter(child=>child.tagName.toLowerCase()===tagName.toLowerCase()&&!child.hasAttribute('data-bj-panel-host'));
    current=panelId?siblings.find(child=>child.dataset.bjPanelId===panelId):siblings[Number(indexText)];
  }
  return current||null;
}

function getTextNodes() {
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];
  let node;
  while((node=walker.nextNode())) {
    const parent=node.parentElement;
    if(!parent || parent.closest('[data-bj-inline-ui],[data-bj-inline-text-id],script,style,noscript,svg,textarea,input,select,option')) continue;
    nodes.push(node);
  }
  return nodes;
}

export default function InlineWebsiteEditor({ pageKey, routePath, publishedPages = {} }) {
  const [user,setUser]=useState(null);
  const [editing,setEditing]=useState(false);
  const [draftPages,setDraftPages]=useState({});
  const [dirty,setDirty]=useState(false);
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [selectedPanel,setSelectedPanel]=useState(null);
  const [widthInput,setWidthInput]=useState('');
  const [heightInput,setHeightInput]=useState('');
  const [selectedElementStyles,setSelectedElementStyles]=useState({});
  const [panelHosts,setPanelHosts]=useState({});
  const allowed=Boolean(user && (user.role==='super_admin' || user.role==='admin' || user.can_edit_website));
  const editingRef=useRef(false);
  const allowedRef=useRef(false);
  const authCheckedRef=useRef(false);
  const pendingToggleRef=useRef(false);
  const loadingRef=useRef(false);
  const dirtyRef=useRef(false);
  const pagesRef=useRef({});
  const basePagesRef=useRef({});
  const selectedPanelRef=useRef(null);
  const panelOriginalStylesRef=useRef(new WeakMap());
  const panelAppliedStylesRef=useRef(new WeakMap());
  const resizeSessionRef=useRef(null);
  const draggedPanelRef=useRef(null);
  const dropTargetRef=useRef(null);
  const pageKeyRef=useRef(pageKey);
  const routePathRef=useRef(routePath);
  const publishedRef=useRef(publishedPages);

  allowedRef.current=allowed;
  editingRef.current=editing;
  pagesRef.current=draftPages;
  pageKeyRef.current=pageKey;
  routePathRef.current=routePath;
  publishedRef.current=publishedPages;

  const currentPage=editing?draftPages?.[pageKey]:publishedPages?.[pageKey];
  const panels=Array.isArray(currentPage?.panels)?currentPage.panels:[];
  const placementSignature=JSON.stringify(panels.map(panel=>[panel.id,panel.placement?.target||'',panel.placement?.edge||'']));

  useLayoutEffect(()=>{
    const hosts={};
    const groups=new Map();
    let active=true;
    let statePublished=false;
    for(const panel of panels) {
      const placement=panel.placement;
      if(!placement?.target||!['before','after'].includes(placement.edge)) continue;
      const key=`${placement.target}\n${placement.edge}`;
      if(!groups.has(key)) groups.set(key,{target:placement.target,edge:placement.edge,panels:[]});
      groups.get(key).panels.push(panel);
    }
    const placedPanels=panels.filter(panel=>panel.placement?.target&&['before','after'].includes(panel.placement.edge));
    const mountAvailableHosts=()=>{
      let changed=false;
      for(const group of groups.values()) {
        if(group.panels.every(panel=>hosts[panel.id]?.isConnected)) continue;
        const target=findElementByPath(group.target);
        if(!target?.parentElement) continue;
        const ordered=group.edge==='after'?[...group.panels].reverse():group.panels;
        for(const panel of ordered) {
          if(hosts[panel.id]?.isConnected) continue;
          const host=document.createElement('div');
          host.className='bj-panel-portal-host';
          host.dataset.bjPanelHost='true';
          if(group.edge==='before') target.parentElement.insertBefore(host,target);
          else target.parentElement.insertBefore(host,target.nextSibling);
          hosts[panel.id]=host;
          changed=true;
        }
      }
      if((changed||!statePublished)&&active){setPanelHosts({...hosts});statePublished=true;}
    };
    const observer=new MutationObserver(mountAvailableHosts);
    mountAvailableHosts();
    if(placedPanels.length) observer.observe(document.body,{subtree:true,childList:true});
    return ()=>{active=false;observer.disconnect();Object.values(hosts).forEach(host=>host.remove());};
  },[pageKey,routePath,editing,placementSignature]);

  useEffect(()=>{
    let active=true;
    api.me().then(({user:current})=>{
      if(!active) return;
      const nextUser=current||null;
      setUser(nextUser);
      authCheckedRef.current=true;
      if(pendingToggleRef.current && nextUser && (nextUser.role==='super_admin'||nextUser.role==='admin'||nextUser.can_edit_website)) {
        pendingToggleRef.current=false;
        enterEditMode(true);
      } else pendingToggleRef.current=false;
    }).catch(()=>{if(active){authCheckedRef.current=true;setUser(null);pendingToggleRef.current=false;}});
    return ()=>{active=false;};
  },[]);

  function updateTextOverride(textId,targetPageKey,value) {
    const current=pagesRef.current||{};
    const page=current[targetPageKey]||{title:'',intro:'',body:''};
    const textOverrides={...(page.textOverrides||{}),[textId]:value};
    const next={...current,[targetPageKey]:{...page,textOverrides}};
    pagesRef.current=next;
    setDraftPages(next);
    dirtyRef.current=true;
    setDirty(true);
    setStatus('Unsaved website changes');
  }

  function makeTextId(node) {
    const parent=node.parentElement;
    if(!parent) return null;
    const shared=Boolean(parent.closest('.bj-header,.site-footer'));
    const targetPageKey=shared?'home':pageKeyRef.current;
    const scope=shared?'shared':routePathRef.current;
    const childIndex=[...parent.childNodes].indexOf(node);
    return {id:`${scope}|${getElementPath(parent)}|t${childIndex}`,targetPageKey};
  }

  function makePanelId(element) {
    const shared=Boolean(element.closest('.bj-header,.site-footer'));
    const targetPageKey=shared?'home':pageKeyRef.current;
    const scope=shared?'shared':routePathRef.current;
    return {id:`${scope}|${getElementPath(element)}`,targetPageKey};
  }

  function panelOriginalStyles(element) {
    const stored=panelOriginalStylesRef.current;
    if(!stored.has(element)) stored.set(element,{width:element.style.width,height:element.style.height,resize:element.style.resize,overflow:element.style.overflow,maxWidth:element.style.maxWidth,display:element.style.display,computedDisplay:window.getComputedStyle(element).display,fontSize:element.style.fontSize,fontFamily:element.style.fontFamily,fontWeight:element.style.fontWeight,fontStyle:element.style.fontStyle,color:element.style.color,backgroundColor:element.style.backgroundColor,textAlign:element.style.textAlign,marginLeft:element.style.marginLeft,marginRight:element.style.marginRight,translate:element.style.translate});
    return stored.get(element);
  }

  function refreshPanelTargets() {
    const active=editingRef.current;
    document.querySelectorAll(sitePanelSelector).forEach(element=>{
      if(element.matches('script,style,noscript,svg,path,bj-inline-text,[data-bj-panel-host]')||element.closest('[data-bj-inline-ui]')) return;
      const original=panelOriginalStyles(element);
      const key=makePanelId(element);
      const page=active?pagesRef.current?.[key.targetPageKey]:publishedRef.current?.[key.targetPageKey];
      const size=page?.panelSizes?.[key.id];
      const style=page?.elementStyles?.[key.id]||{};
      const selected=element===selectedPanelRef.current?.element;
      const appliedSignature=JSON.stringify([key.id,key.targetPageKey,active,size||null,style,selected]);
      if(panelAppliedStylesRef.current.get(element)===appliedSignature) return;
      panelAppliedStylesRef.current.set(element,appliedSignature);
      element.style.width=size?.width?`${size.width}px`:original.width;
      element.style.height=size?.height?`${size.height}px`:original.height;
      element.style.maxWidth=size?.width?'100%':original.maxWidth;
      element.style.overflow=size?.height?'auto':original.overflow;
      element.style.display=(size?.width||size?.height)&&original.computedDisplay==='inline'?'inline-block':original.display;
      applyElementStyleOverrides(element,style,original);
      if(active) {
        element.dataset.bjResizeId=key.id;
        element.dataset.bjResizePage=key.targetPageKey;
        element.classList.add('bj-resizable-site-panel');
        if(selected) {
          element.classList.add('bj-inline-panel-selected');
          element.style.resize='both';
          element.style.overflow='auto';
          element.style.maxWidth='100%';
        } else {
          element.classList.remove('bj-inline-panel-selected');
          element.style.resize=original.resize;
        }
      } else {
        delete element.dataset.bjResizeId;
        delete element.dataset.bjResizePage;
        element.classList.remove('bj-resizable-site-panel','bj-inline-panel-selected');
        element.style.resize=original.resize;
      }
    });
  }

  function choosePanel(element) {
    if(!element) return;
    const previous=selectedPanelRef.current?.element;
    if(previous && previous!==element) {
      const original=panelOriginalStylesRef.current.get(previous);
      previous.classList.remove('bj-inline-panel-selected');
      if(original){const size=pagesRef.current?.[previous.dataset.bjResizePage]?.panelSizes?.[previous.dataset.bjResizeId];previous.style.resize=original.resize;previous.style.overflow=size?.height?'auto':original.overflow;previous.style.display=(size?.width||size?.height)&&original.computedDisplay==='inline'?'inline-block':original.display;}
    }
    const key=makePanelId(element);
    const page=pagesRef.current?.[key.targetPageKey]||{};
    const size=page.panelSizes?.[key.id];
    const style={...(page.elementStyles?.[key.id]||{})};
    if(element.matches('.bj-header-actions>.bj-write-button')&&!style.positionTouched){delete style.offsetX;delete style.offsetY;}
    const rect=element.getBoundingClientRect();
    const choice={...key,element,width:size?.width||Math.round(rect.width),height:size?.height||Math.round(rect.height)};
    selectedPanelRef.current=choice;
    setSelectedPanel(choice);
    setWidthInput(String(choice.width));
    setHeightInput(String(choice.height));
    setSelectedElementStyles(style);
    const original=panelOriginalStyles(element);
    element.classList.add('bj-inline-panel-selected');
    element.style.resize='both';
    element.style.overflow='auto';
    element.style.maxWidth='100%';
    if(original.computedDisplay==='inline') element.style.display='inline-block';
    if(!size?.width) element.style.width=original.width;
    if(!size?.height) element.style.height=original.height;
    setStatus('Item selected. Resize it or open Style item to change its appearance.');
  }

  function updatePanelSize(choice,widthValue,heightValue) {
    if(!choice) return;
    const width=Math.min(1600,Math.max(40,Math.round(Number(widthValue)||40)));
    const height=Math.min(1600,Math.max(24,Math.round(Number(heightValue)||24)));
    const current=pagesRef.current||{};
    const page=current[choice.targetPageKey]||{title:'',intro:'',body:''};
    const panelSizes={...(page.panelSizes||{}),[choice.id]:{width,height}};
    const next={...current,[choice.targetPageKey]:{...page,panelSizes}};
    pagesRef.current=next;
    setDraftPages(next);
    const updated={...choice,width,height};
    selectedPanelRef.current=updated;
    setSelectedPanel(updated);
    setWidthInput(String(width));
    setHeightInput(String(height));
    if(choice.element?.isConnected){choice.element.style.width=`${width}px`;choice.element.style.height=`${height}px`;choice.element.style.maxWidth='100%';}
    dirtyRef.current=true;
    setDirty(true);
    setStatus('Unsaved website design changes');
  }

  function resetPanelSize(choice) {
    if(!choice) return;
    const current=pagesRef.current||{};
    const page=current[choice.targetPageKey]||{title:'',intro:'',body:''};
    const panelSizes={...(page.panelSizes||{})};
    delete panelSizes[choice.id];
    const nextPage={...page};
    if(Object.keys(panelSizes).length) nextPage.panelSizes=panelSizes;
    else delete nextPage.panelSizes;
    const next={...current,[choice.targetPageKey]:nextPage};
    pagesRef.current=next;
    setDraftPages(next);
    const original=choice.element?.isConnected?panelOriginalStylesRef.current.get(choice.element):null;
    if(choice.element?.isConnected&&original) {
      choice.element.style.width=original.width;
      choice.element.style.height=original.height;
      choice.element.style.maxWidth=original.maxWidth;
      choice.element.style.overflow='auto';
      choice.element.style.display=original.computedDisplay==='inline'?'inline-block':original.display;
      const rect=choice.element.getBoundingClientRect();
      const updated={...choice,width:Math.round(rect.width),height:Math.round(rect.height)};
      selectedPanelRef.current=updated;
      setSelectedPanel(updated);
      setWidthInput(String(updated.width));
      setHeightInput(String(updated.height));
    }
    dirtyRef.current=true;
    setDirty(true);
    setStatus('Item size reset. Save the draft to keep this change.');
  }

  function updateElementStyle(choice,property,value) {
    if(!choice||!elementStyleProperties.includes(property)) return;
    if(property==='afterContent'&&value!=null) value=String(value).trim().slice(0,80);
    const current=pagesRef.current||{};
    const page=current[choice.targetPageKey]||{title:'',intro:'',body:''};
    const elementStyles={...(page.elementStyles||{})};
    const itemStyle={...(elementStyles[choice.id]||{})};
    const headerAction=choice.element?.matches('.bj-header-actions>.bj-write-button');
    if(headerAction&&!itemStyle.positionTouched){delete itemStyle.offsetX;delete itemStyle.offsetY;}
    if(value===''||value==null) delete itemStyle[property];
    else if(property==='fontSize'||property==='afterFontSize') itemStyle[property]=Math.min(96,Math.max(8,Math.round(Number(value)||8)));
    else if(property==='offsetX'||property==='offsetY') itemStyle[property]=Math.min(1000,Math.max(-1000,Math.round(Number(value)||0)));
    else itemStyle[property]=value;
    if(property==='offsetX'||property==='offsetY') itemStyle.positionTouched=true;
    if(Object.keys(itemStyle).length) elementStyles[choice.id]=itemStyle;
    else delete elementStyles[choice.id];
    const next={...current,[choice.targetPageKey]:{...page,elementStyles}};
    pagesRef.current=next;
    setDraftPages(next);
    setSelectedElementStyles(itemStyle);
    const original=choice.element?.isConnected?panelOriginalStylesRef.current.get(choice.element):null;
    if(choice.element?.isConnected) applyElementStyleOverrides(choice.element,itemStyle,original);
    dirtyRef.current=true;
    setDirty(true);
    setStatus('Unsaved website design changes');
  }

  function resetElementStyles() {
    if(!selectedPanel) return;
    elementStyleProperties.forEach(property=>updateElementStyle(selectedPanel,property,''));
    setSelectedElementStyles({});
  }

  function addPanel() {
    const targetPageKey=pageKeyRef.current;
    const current=pagesRef.current||{};
    const page=current[targetPageKey]||{title:'',intro:'',body:''};
    const panels=page.panels||[];
    if(panels.length>=20){setStatus('A page can have up to 20 custom panels.');return;}
    const id=globalThis.crypto?.randomUUID?.()||`panel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next={...current,[targetPageKey]:{...page,panels:[...panels,{id,title:'New panel',body:'Click this text to add content.'}]}};
    pagesRef.current=next;
    setDraftPages(next);
    dirtyRef.current=true;
    setDirty(true);
    setStatus('Panel added. Click its text to edit it.');
  }

  function removePanel(id) {
    const targetPageKey=pageKeyRef.current;
    const current=pagesRef.current||{};
    const page=current[targetPageKey]||{};
    const next={...current,[targetPageKey]:{...page,panels:(page.panels||[]).filter(panel=>panel.id!==id)}};
    pagesRef.current=next;
    setDraftPages(next);
    if(selectedPanelRef.current?.element?.dataset?.bjPanelId===id){selectedPanelRef.current=null;setSelectedPanel(null);}
    dirtyRef.current=true;
    setDirty(true);
    setStatus('Panel removed from the draft.');
  }

  function setPanelPlacement(draggedId,targetElement,edge) {
    if(!targetElement?.isConnected||targetElement.classList.contains('bj-custom-panel')) return;
    const target=getElementPath(targetElement);
    if(!target) return;
    const targetPageKey=pageKeyRef.current;
    const current=pagesRef.current||{};
    const page=current[targetPageKey]||{title:'',intro:'',body:''};
    const panels=(page.panels||[]).map(panel=>panel.id===draggedId?{...panel,placement:{target,edge}}:panel);
    if(!panels.some(panel=>panel.id===draggedId)) return;
    const next={...current,[targetPageKey]:{...page,panels}};
    pagesRef.current=next;
    setDraftPages(next);
    dirtyRef.current=true;
    setDirty(true);
    setStatus('Panel positioned on the page. Save the draft to keep this layout.');
  }

  function clearDropMarker() {
    const previous=dropTargetRef.current;
    if(previous?.element) previous.element.classList.remove('bj-inline-panel-drop-before','bj-inline-panel-drop-after');
    dropTargetRef.current=null;
  }

  function setDropMarker(element,edge) {
    const previous=dropTargetRef.current;
    if(previous?.element===element&&previous.edge===edge) return;
    clearDropMarker();
    if(!element) return;
    element.classList.add(edge==='before'?'bj-inline-panel-drop-before':'bj-inline-panel-drop-after');
    dropTargetRef.current={element,edge};
  }

  useEffect(()=>{
    const selected=selectedPanelRef.current?.element;
    if(selected){
      const original=panelOriginalStylesRef.current.get(selected);
      selected.classList.remove('bj-inline-panel-selected');
      if(original){selected.style.resize=original.resize;selected.style.overflow=original.overflow;}
    }
    selectedPanelRef.current=null;
    setSelectedPanel(null);
    setSelectedElementStyles({});
    setWidthInput('');
    setHeightInput('');
  },[pageKey,routePath]);

  function unwrapEditableText() {
    document.querySelectorAll('[data-bj-inline-text-id]').forEach(wrapper=>{
      wrapper.replaceWith(document.createTextNode(wrapper.textContent||''));
    });
  }

  function refreshInlineTargets() {
    const active=editingRef.current;
    if(!active) unwrapEditableText();
    const nodes=getTextNodes();
    for(const node of nodes) {
      const key=makeTextId(node);
      if(!key) continue;
      const source=active
        ? pagesRef.current?.[key.targetPageKey]?.textOverrides
        : publishedRef.current?.[key.targetPageKey]?.textOverrides;
      const overrides=isTextOverrideMap(source)?source:{};
      const hasOverride=Object.prototype.hasOwnProperty.call(overrides,key.id);
      if(hasOverride && node.nodeValue!==overrides[key.id]) node.nodeValue=overrides[key.id];
      if(!active) continue;
      if(node.parentElement?.closest('[data-bj-inline-text-id]')) continue;
      if(!node.nodeValue.trim() && !hasOverride) continue;
      const wrapper=document.createElement('bj-inline-text');
      wrapper.dataset.bjInlineTextId=key.id;
      wrapper.dataset.bjInlinePage=key.targetPageKey;
      wrapper.className='bj-inline-editable-text';
      wrapper.setAttribute('contenteditable','plaintext-only');
      wrapper.setAttribute('spellcheck','true');
      wrapper.setAttribute('aria-label','Edit website text');
      node.replaceWith(wrapper);
      wrapper.appendChild(node);
    }
    refreshPanelTargets();
  }

  async function enterEditMode(permissionConfirmed=false) {
    if((!allowedRef.current&&!permissionConfirmed) || loadingRef.current) return;
    loadingRef.current=true;
    setBusy(true);
    setStatus('Loading website draft…');
    try {
      const result=await api.adminPages();
      const next=result.draft||{};
      pagesRef.current=next;
      basePagesRef.current=next;
      dirtyRef.current=false;
      setDraftPages(next);
      setDirty(false);
      setEditing(true);
      setStatus('Click text to edit it, or select any item to resize and style it.');
    } catch(error) {
      setStatus(error.message||'Could not load the website draft.');
    } finally {
      loadingRef.current=false;
      setBusy(false);
    }
  }

  function exitEditMode() {
    if(dirtyRef.current && !window.confirm('Discard unsaved website edits? Save your draft first to keep them.')) return;
    if(dirtyRef.current) {
      pagesRef.current=basePagesRef.current||{};
      setDraftPages(basePagesRef.current||{});
      dirtyRef.current=false;
      setDirty(false);
    }
    editingRef.current=false;
    setEditing(false);
    setStatus('');
  }

  useEffect(()=>{
    const toggle=()=>{
      if(!allowedRef.current) { if(!authCheckedRef.current) pendingToggleRef.current=true; return; }
      if(editingRef.current) exitEditMode();
      else enterEditMode();
    };
    window.addEventListener('bj-toggle-website-inline-edit',toggle);
    return ()=>window.removeEventListener('bj-toggle-website-inline-edit',toggle);
  },[]);

  useEffect(()=>{
    document.documentElement.dataset.websiteInlineEditing=editing?'true':'false';
    window.dispatchEvent(new CustomEvent('bj-website-inline-edit-state',{detail:{active:editing}}));
    refreshInlineTargets();
    const observer=new MutationObserver(()=>refreshInlineTargets());
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    return ()=>{
      observer.disconnect();
      if(editing) unwrapEditableText();
      document.documentElement.dataset.websiteInlineEditing='false';
      window.dispatchEvent(new CustomEvent('bj-website-inline-edit-state',{detail:{active:false}}));
    };
  },[editing,pageKey,routePath,publishedPages]);

  useEffect(()=>{
    if(!editing || !allowed) return undefined;
    const onClick=event=>{
      if(event.target.closest('[data-bj-inline-ui]')) return;
      const panel=event.target.closest('[data-bj-resize-id]');
      if(panel) choosePanel(panel);
      const wrapper=event.target.closest('[data-bj-inline-text-id]');
      const interactive=event.target.closest('a,button');
      if(interactive) { event.preventDefault(); event.stopPropagation(); if(wrapper) wrapper.focus(); }
    };
    const onInput=event=>{
      const wrapper=event.target.closest('[data-bj-inline-text-id]');
      if(wrapper) updateTextOverride(wrapper.dataset.bjInlineTextId,wrapper.dataset.bjInlinePage,wrapper.textContent||'');
    };
    const onKeyDown=event=>{
      if(event.target.closest('[data-bj-inline-text-id]') && event.key==='Enter') event.preventDefault();
    };
    const onPointerDown=event=>{
      const panel=event.target.closest('[data-bj-resize-id]');
      if(!panel?.classList.contains('bj-inline-panel-selected')) return;
      const rect=panel.getBoundingClientRect();
      if(event.clientX>=rect.right-24 && event.clientY>=rect.bottom-24) resizeSessionRef.current={element:panel,id:panel.dataset.bjResizeId,targetPageKey:panel.dataset.bjResizePage,width:rect.width,height:rect.height};
    };
    const onPointerUp=()=>{
      const session=resizeSessionRef.current;
      resizeSessionRef.current=null;
      if(!session?.element?.isConnected) return;
      const rect=session.element.getBoundingClientRect();
      if(Math.abs(rect.width-session.width)>2 || Math.abs(rect.height-session.height)>2) updatePanelSize({...session,element:session.element},rect.width,rect.height);
    };
    const hasPanelDrag=event=>Boolean(draggedPanelRef.current||[...(event.dataTransfer?.types||[])].includes('application/x-bytejournal-panel'));
    const onDragStart=event=>{
      const handle=event.target.closest?.('.bj-custom-panel-drag');
      const panel=handle?.closest('[data-bj-panel-id]');
      if(panel) draggedPanelRef.current=panel.dataset.bjPanelId;
    };
    const onDragOver=event=>{
      if(!hasPanelDrag(event)) return;
      const target=event.target.closest?.('[data-bj-resize-id]');
      if(!target||target.classList.contains('bj-custom-panel')||target.dataset.bjPanelId===draggedPanelRef.current) { clearDropMarker(); return; }
      event.preventDefault();
      event.dataTransfer.dropEffect='move';
      const rect=target.getBoundingClientRect();
      setDropMarker(target,event.clientY<rect.top+rect.height/2?'before':'after');
    };
    const onDrop=event=>{
      if(!hasPanelDrag(event)) return;
      const target=event.target.closest?.('[data-bj-resize-id]');
      const draggedId=event.dataTransfer?.getData('application/x-bytejournal-panel')||event.dataTransfer?.getData('text/plain')||draggedPanelRef.current;
      if(!target||target.classList.contains('bj-custom-panel')||!draggedId||target.dataset.bjPanelId===draggedId) { clearDropMarker(); return; }
      event.preventDefault();
      event.stopPropagation();
      const rect=target.getBoundingClientRect();
      setPanelPlacement(draggedId,target,event.clientY<rect.top+rect.height/2?'before':'after');
      clearDropMarker();
    };
    const onDragEnd=()=>{draggedPanelRef.current=null;clearDropMarker();};
    document.addEventListener('click',onClick,true);
    document.addEventListener('input',onInput,true);
    document.addEventListener('keydown',onKeyDown,true);
    document.addEventListener('pointerdown',onPointerDown,true);
    document.addEventListener('pointerup',onPointerUp,true);
    document.addEventListener('dragstart',onDragStart,true);
    document.addEventListener('dragover',onDragOver,true);
    document.addEventListener('drop',onDrop,true);
    document.addEventListener('dragend',onDragEnd,true);
    return ()=>{
      document.removeEventListener('click',onClick,true);
      document.removeEventListener('input',onInput,true);
      document.removeEventListener('keydown',onKeyDown,true);
      document.removeEventListener('pointerdown',onPointerDown,true);
      document.removeEventListener('pointerup',onPointerUp,true);
      document.removeEventListener('dragstart',onDragStart,true);
      document.removeEventListener('dragover',onDragOver,true);
      document.removeEventListener('drop',onDrop,true);
      document.removeEventListener('dragend',onDragEnd,true);
      clearDropMarker();
      draggedPanelRef.current=null;
    };
  },[editing,allowed]);

  async function saveDraft() {
    setBusy(true);
    setStatus('Saving website draft…');
    try {
      const result=await api.updatePages(pagesRef.current);
      const next=result.pages||pagesRef.current;
      pagesRef.current=next;
      basePagesRef.current=next;
      setDraftPages(next);
      dirtyRef.current=false;
      setDirty(false);
      setStatus('Website draft saved.');
    } catch(error) {
      setStatus(error.message||'Could not save the website draft.');
    } finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true);
    setStatus('Publishing website changes…');
    try {
      let next=pagesRef.current;
      if(dirtyRef.current) {
        const result=await api.updatePages(next);
        next=result.pages||next;
        pagesRef.current=next;
        basePagesRef.current=next;
        setDraftPages(next);
      }
      await api.publishPages();
      dirtyRef.current=false;
      setDirty(false);
      window.dispatchEvent(new Event('siteSettingsUpdated'));
      setStatus('Website changes published.');
    } catch(error) {
      setStatus(error.message||'Could not publish website changes.');
    } finally { setBusy(false); }
  }

  const unplacedPanels=panels.filter(panel=>!panelHosts[panel.id]);
  return <>
    <WebsitePanelList panels={unplacedPanels} editing={editing&&allowed} onRemove={removePanel}/>
    {panels.filter(panel=>panelHosts[panel.id]).map(panel=>createPortal(<article className="bj-custom-panel" data-bj-panel-id={panel.id} key={panel.id}>
      {editing&&allowed&&<button type="button" className="bj-custom-panel-drag" data-bj-inline-ui="true" draggable="true" aria-label={`Drag ${panel.title||'panel'} to reposition it`} onDragStart={event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',panel.id);event.dataTransfer.setData('application/x-bytejournal-panel',panel.id);}}><GripVertical size={15}/> Drag to move</button>}
      <h2>{panel.title||'New panel'}</h2><p>{panel.body||'Click this text to add content.'}</p>
      {editing&&allowed&&<button type="button" data-bj-inline-ui="true" onClick={()=>removePanel(panel.id)}>Remove panel</button>}
    </article>,panelHosts[panel.id],panel.id))}
    {editing&&allowed&&<aside className="bj-inline-editor-toolbar" data-bj-inline-ui="true" aria-label="Website editing controls">
      <div className="bj-inline-editor-copy"><strong>Edit Website</strong><span>{dirty?'Unsaved website changes':status||'Click text to edit it, select an item to resize or style it, or drag a panel handle onto the page.'}</span></div>
      {selectedPanel&&<div className="bj-inline-editor-size-controls"><label>Width<input type="number" min="40" max="1600" value={widthInput} onChange={event=>setWidthInput(event.target.value)} onBlur={()=>updatePanelSize(selectedPanel,widthInput,heightInput)}/></label><label>Height<input type="number" min="24" max="1600" value={heightInput} onChange={event=>setHeightInput(event.target.value)} onBlur={()=>updatePanelSize(selectedPanel,widthInput,heightInput)}/></label></div>}
      {selectedPanel&&<details className="bj-inline-style-controls" data-bj-inline-ui="true"><summary>Style item</summary><div className="bj-inline-style-popover">
        <label>Text size<input type="number" min="8" max="96" placeholder="Theme" value={selectedElementStyles.fontSize||''} onChange={event=>setSelectedElementStyles(current=>({...current,fontSize:event.target.value}))} onBlur={event=>updateElementStyle(selectedPanel,'fontSize',event.currentTarget.value)}/></label>
        <label>Font family<select value={selectedElementStyles.fontFamily||''} onChange={event=>updateElementStyle(selectedPanel,'fontFamily',event.target.value)}><option value="">Theme</option><option value="system">System</option><option value="manrope">Manrope</option><option value="inter">Inter</option><option value="serif">Serif</option><option value="mono">Monospace</option></select></label>
        <label>Font weight<select value={selectedElementStyles.fontWeight||''} onChange={event=>updateElementStyle(selectedPanel,'fontWeight',event.target.value)}><option value="">Theme</option><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option></select></label>
        <label>Font style<select value={selectedElementStyles.fontStyle||''} onChange={event=>updateElementStyle(selectedPanel,'fontStyle',event.target.value)}><option value="">Theme</option><option value="normal">Normal</option><option value="italic">Italic</option></select></label>
        <label>Text color<span className="bj-inline-color-control"><input type="color" aria-label="Text color" value={selectedElementStyles.color||'#ffffff'} onChange={event=>updateElementStyle(selectedPanel,'color',event.target.value)}/><button type="button" onClick={()=>updateElementStyle(selectedPanel,'color','')}>Theme</button></span></label>
        <label>Background<span className="bj-inline-color-control"><input type="color" aria-label="Background color" value={selectedElementStyles.backgroundColor||'#ffffff'} onChange={event=>updateElementStyle(selectedPanel,'backgroundColor',event.target.value)}/><button type="button" onClick={()=>updateElementStyle(selectedPanel,'backgroundColor','')}>Theme</button></span></label>
        <label>Item alignment<select value={selectedElementStyles.alignment||''} onChange={event=>updateElementStyle(selectedPanel,'alignment',event.target.value)}><option value="">Theme</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <label>Text alignment<select value={selectedElementStyles.textAlign||''} onChange={event=>updateElementStyle(selectedPanel,'textAlign',event.target.value)}><option value="">Theme</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
        <label>Position X (px)<input type="number" min="-1000" max="1000" placeholder="0" value={selectedElementStyles.offsetX??''} onChange={event=>setSelectedElementStyles(current=>({...current,offsetX:event.target.value}))} onBlur={event=>updateElementStyle(selectedPanel,'offsetX',event.currentTarget.value)}/></label>
        <label>Position Y (px)<input type="number" min="-1000" max="1000" placeholder="0" value={selectedElementStyles.offsetY??''} onChange={event=>setSelectedElementStyles(current=>({...current,offsetY:event.target.value}))} onBlur={event=>updateElementStyle(selectedPanel,'offsetY',event.currentTarget.value)}/></label>
        <fieldset className="bj-inline-style-group"><legend>Hover</legend>
          <label>Text color<span className="bj-inline-color-control"><input type="color" aria-label="Hover text color" value={selectedElementStyles.hoverColor||'#ffffff'} onChange={event=>updateElementStyle(selectedPanel,'hoverColor',event.target.value)}/><button type="button" onClick={()=>updateElementStyle(selectedPanel,'hoverColor','')}>Theme</button></span></label>
          <label>Background<span className="bj-inline-color-control"><input type="color" aria-label="Hover background color" value={selectedElementStyles.hoverBackgroundColor||'#ffffff'} onChange={event=>updateElementStyle(selectedPanel,'hoverBackgroundColor',event.target.value)}/><button type="button" onClick={()=>updateElementStyle(selectedPanel,'hoverBackgroundColor','')}>Theme</button></span></label>
        </fieldset>
        <fieldset className="bj-inline-style-group"><legend>After (::after)</legend>
          <label>Content<input type="text" maxLength="80" placeholder="Text after item" value={selectedElementStyles.afterContent||''} onChange={event=>setSelectedElementStyles(current=>({...current,afterContent:event.target.value}))} onBlur={event=>updateElementStyle(selectedPanel,'afterContent',event.currentTarget.value)}/></label>
          <label>Text color<span className="bj-inline-color-control"><input type="color" aria-label="After text color" value={selectedElementStyles.afterColor||'#ffffff'} onChange={event=>updateElementStyle(selectedPanel,'afterColor',event.target.value)}/><button type="button" onClick={()=>updateElementStyle(selectedPanel,'afterColor','')}>Theme</button></span></label>
          <label>Background<span className="bj-inline-color-control"><input type="color" aria-label="After background color" value={selectedElementStyles.afterBackgroundColor||'#ffffff'} onChange={event=>updateElementStyle(selectedPanel,'afterBackgroundColor',event.target.value)}/><button type="button" onClick={()=>updateElementStyle(selectedPanel,'afterBackgroundColor','')}>Theme</button></span></label>
          <label>Text size<input type="number" min="8" max="96" placeholder="Theme" value={selectedElementStyles.afterFontSize||''} onChange={event=>setSelectedElementStyles(current=>({...current,afterFontSize:event.target.value}))} onBlur={event=>updateElementStyle(selectedPanel,'afterFontSize',event.currentTarget.value)}/></label>
        </fieldset>
        <button type="button" className="bj-inline-style-reset" onClick={()=>resetPanelSize(selectedPanel)}>Reset item size</button>
        <button type="button" className="bj-inline-style-reset" onClick={resetElementStyles}>Reset item style</button>
      </div></details>}
      <button type="button" className="bj-inline-editor-add" onClick={addPanel} disabled={busy||panels.length>=20}>Add panel</button>
      <button type="button" className="bj-inline-editor-save" onClick={saveDraft} disabled={busy||!dirty}><Save size={15}/> Save draft</button>
      <button type="button" className="bj-inline-editor-publish" onClick={publish} disabled={busy}><Eye size={15}/> Publish</button>
      <button type="button" className="bj-inline-editor-exit" onClick={exitEditMode} disabled={busy} aria-label="Exit website edit mode">{busy?'Working…':<><Check size={15}/> Done</>}</button>
      <span className="bj-inline-editor-status" aria-live="polite">{status}</span>
    </aside>}
  </>;
}
