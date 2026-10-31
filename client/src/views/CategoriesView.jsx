import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Braces, BrainCircuit, Cloud, Code2, Database, GitBranch, Globe2, Network, ShieldCheck, Terminal, ArrowUpRight } from 'lucide-react';
import { api } from '../api';
import { SitePageBody, useSitePageContent } from '../controllers/sitePageContent';
import { headerCategories } from '../components/Header';
import './PublicPages.css';

const descriptions = [
  'Frontend engineering, backend services, APIs, and modern web platforms.',
  'Core languages, runtimes, tooling, patterns, and practical techniques.',
  'Machine learning, generative AI, neural networks, and responsible innovation.',
  'Problem solving, complexity, algorithms, and foundational data structures.',
  'Architecture, distributed systems, scalability, and reliability.',
  'Infrastructure as code, containers, automation, and cloud-native operations.',
  'Application security, threat models, privacy, and defensive engineering.',
  'Relational and NoSQL databases, query design, indexing, and data modeling.',
  'Protocols, routing, network architecture, and internet fundamentals.',
  'Community projects, contribution workflows, and open tooling.'
];
const icons = [Globe2, Code2, BrainCircuit, GitBranch, Network, Cloud, ShieldCheck, Database, Terminal, Braces];
const categoryMeta = headerCategories.map(([name,slug],index)=>({name,slug,description:descriptions[index],Icon:icons[index]}));

export default function CategoriesView(){
  const pageContent=useSitePageContent('categories');
  const [counts,setCounts]=useState({}); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{document.title=`${pageContent.title||'Categories'} | ByteJournal`;let active=true;api.categories().then(({categories=[]})=>{if(active)setCounts(Object.fromEntries(categories.map(c=>[c.category,c.count])))}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[pageContent.title]);
  const countFor=(name)=>{const match=Object.entries(counts).find(([key])=>key.toLowerCase()===name.toLowerCase() || key.toLowerCase().includes(name.split(' ')[0].toLowerCase()));return match?.[1]||0};
  return <main className="public-page"><div className="public-page-heading"><span className="section-kicker">EXPLORE THE STACK / 02</span><h1>{pageContent.title||<>Find your <em>discipline.</em></>}</h1><p>{pageContent.intro||'Browse the ideas, tools, and systems that make modern technology work.'}</p></div>
    <SitePageBody page={pageContent}/>
    {error&&<p className="bj-inline-error" role="status">Live category counts are unavailable: {error}</p>}
    <div className="bj-category-cards">{categoryMeta.map(({name,slug,description,Icon},i)=><Link className="bj-category-card" to={`/categories/${slug}`} key={slug}><span className="bj-card-index">{String(i+1).padStart(2,'0')}</span><span className="bj-category-icon"><Icon size={22}/></span><h2>{name}</h2><p>{description}</p><span className="bj-category-card-bottom">{loading?'…':`${countFor(name)} published articles`}<ArrowUpRight size={15}/></span></Link>)}</div>
  </main>;
}
