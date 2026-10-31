const requiredHeaders=['title','excerpt','category','content'];

export const articleCsvTemplate = [
  'title,slug,excerpt,category,author,content,tags,cover_color,cover_image,seo_title,meta_description,canonical_url,featured',
  '"A Practical Guide to Reliable APIs",a-practical-guide-to-reliable-apis,"Learn the design choices that keep APIs predictable and resilient.",Backend,,"<h2>Start with clear boundaries</h2><p>Keep each API responsibility focused and document its contract.</p>",backend|api|architecture,blue,,,"Practical guidance for designing reliable APIs.",,false'
].join('\r\n');

function parseRows(input) {
  const text=String(input||'').replace(/^\uFEFF/,'');
  const rows=[];
  let row=[];
  let value='';
  let quoted=false;
  for(let i=0;i<text.length;i+=1){
    const char=text[i];
    if(quoted){
      if(char==='"'&&text[i+1]==='"'){value+='"';i+=1;}
      else if(char==='"') quoted=false;
      else value+=char;
      continue;
    }
    if(char==='"'&&value===''){quoted=true;continue;}
    if(char===','){row.push(value);value='';continue;}
    if(char==='\n'||char==='\r'){
      if(char==='\r'&&text[i+1]==='\n') i+=1;
      row.push(value);value='';
      if(row.some(cell=>cell.trim())) rows.push(row);
      row=[];
      continue;
    }
    value+=char;
  }
  if(quoted) throw new Error('The CSV has an unclosed quoted field.');
  row.push(value);
  if(row.some(cell=>cell.trim())) rows.push(row);
  return rows;
}

export function parseArticleCsv(input) {
  const rows=parseRows(input);
  if(rows.length<2) throw new Error('Add a header row and at least one article row to the CSV.');
  const headers=rows[0].map(header=>header.trim().toLowerCase());
  if(headers.some((header,index)=>header&&headers.indexOf(header)!==index)) throw new Error('The CSV contains a duplicate column name.');
  const missing=requiredHeaders.filter(header=>!headers.includes(header));
  if(missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}.`);
  const records=rows.slice(1).map((cells,index)=>({
    rowNumber:index+2,
    values:Object.fromEntries(headers.map((header,column)=>[header,(cells[column]||'').trim()])),
    extraValues:cells.length>headers.length
  }));
  if(records.length>100) throw new Error('Import up to 100 articles at a time.');
  return records;
}
