import { useEffect, useState } from 'react';

const pageSizes=[5,25,50,100];

export default function CmsPaginatedList({items=[],itemLabel='items',className='management-list',renderItem}) {
  const [pageSize,setPageSize]=useState(5);
  const [page,setPage]=useState(1);
  const pageCount=Math.max(1,Math.ceil(items.length/pageSize));
  const currentPage=Math.min(page,pageCount);
  const pageItems=items.slice((currentPage-1)*pageSize,currentPage*pageSize);

  useEffect(()=>setPage(1),[items.length]);

  if(!items.length) return null;
  return <>
    <div className="cms-list-toolbar">
      <span>{items.length} {itemLabel}</span>
      <label className="articles-page-size"><span>Rows per page</span><select aria-label={`${itemLabel} rows per page`} value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1);}}>{pageSizes.map(size=><option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    <div className={className}>{pageItems.map(renderItem)}</div>
    {pageCount>1&&<div className="cms-pagination" aria-label={`${itemLabel} pages`}>
      <span>Showing {(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,items.length)} of {items.length}</span>
      <div><button type="button" className="button button-outline button-small" onClick={()=>setPage(currentPage-1)} disabled={currentPage===1}>Previous</button><span className="cms-page-count">Page {currentPage} of {pageCount}</span><button type="button" className="button button-outline button-small" onClick={()=>setPage(currentPage+1)} disabled={currentPage===pageCount}>Next</button></div>
    </div>}
  </>;
}
