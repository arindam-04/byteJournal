import { ChevronDown } from 'lucide-react';

export default function CmsRowActions({ariaLabel='Row actions',children}) {
  const closeMenu=event=>{
    if(event.target.closest('button,a')) event.currentTarget.closest('details').open=false;
  };
  return <div className="cms-row-actions">
    <details className="cms-article-actions">
      <summary aria-label={ariaLabel}>Actions <ChevronDown size={13}/></summary>
      <div className="cms-action-menu" onClick={closeMenu}>{children}</div>
    </details>
  </div>;
}
