import { deflateSync, inflateSync } from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { envMinimal } from './render.js'
const run=promisify(execFile), marker=Buffer.from('\n%KANVAS-DOCUMENT-1 '), MAX=32*1024*1024
function check(b){if(!Buffer.isBuffer(b)||b.length>64*1024*1024||b.toString('ascii',0,5)!=='%PDF-')throw Error('Invalid PDF or size limit exceeded')}
export function embedHybridKanvas(pdf,doc){check(pdf);const raw=Buffer.from(JSON.stringify(doc));if(raw.length>MAX)throw Error('Hybrid document exceeds 32 MiB');const end=pdf.lastIndexOf('startxref');if(end<0)throw Error('Missing PDF trailer');return Buffer.concat([pdf.subarray(0,end),marker,Buffer.from(deflateSync(raw).toString('base64')+'\n'),pdf.subarray(end)])}
export function extractHybridKanvas(pdf){check(pdf);const end=pdf.lastIndexOf('startxref'),off=pdf.lastIndexOf(marker,end);if(off<0)return null;const data=pdf.toString('ascii',off+marker.length,end).trim();if(!/^[A-Za-z0-9+/]+=*$/.test(data))throw Error('Invalid hybrid payload');const d=JSON.parse(inflateSync(Buffer.from(data,'base64'),{maxOutputLength:MAX}));if(!Array.isArray(d?.artboards))throw Error('Invalid hybrid design');return d}
// WinRT sizes are DIPs (96/in), the same unit that Kanvas uses for PDF pages.
// Fixed script, private cwd, fixed filenames; no document data enters shell source.
const script=`$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null=[Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]
$task=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1}
$generic=$task | Where-Object {$_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\u00601'} | Select-Object -First 1
$action=$task | Where-Object {!$_.IsGenericMethod} | Select-Object -First 1
function waitop($op,$type){$t=$generic.MakeGenericMethod($type).Invoke($null,@($op));$t.Wait();$t.Result}
$f=waitop ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Join-Path (Get-Location) 'source.pdf'))) ([Windows.Storage.StorageFile])
$d=waitop ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($f)) ([Windows.Data.Pdf.PdfDocument]); if($d.PageCount -gt 32){throw 'Maximum 32 pages'}
$pages=@();$pixels=0
for($i=0;$i -lt $d.PageCount;$i++){$p=$d.GetPage($i);try{$w=$p.Size.Width;$h=$p.Size.Height;$pages+=@{w=$w;h=$h};if($env:KANVAS_RASTER -eq '1'){$pixels+=[math]::Ceiling($w*2)*[math]::Ceiling($h*2);if($pixels -gt 64000000 -or $w -gt 4096 -or $h -gt 4096){throw 'PDF pixel budget exceeded'}
$s=New-Object Windows.Storage.Streams.InMemoryRandomAccessStream;try{$o=New-Object Windows.Data.Pdf.PdfPageRenderOptions;$o.DestinationWidth=[uint32][math]::Round($w*2);$o.DestinationHeight=[uint32][math]::Round($h*2);$o.BitmapEncoderId=[Windows.Graphics.Imaging.BitmapEncoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]::JpegEncoderId;$t=$action.Invoke($null,@($p.RenderToStreamAsync($s,$o)));$t.Wait();$s.Seek(0);$stream=[System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($s);$out=[IO.File]::Create((Join-Path (Get-Location) ($i.ToString()+'.jpg')));try{$stream.CopyTo($out)}finally{$out.Dispose()}}finally{$s.Dispose()}}}finally{$p.Dispose()}}
ConvertTo-Json -Compress -InputObject $pages`
async function parse(pdf,raster){check(pdf);if(process.platform!=='win32')throw Error('External PDF renderer requires Windows.Data.Pdf on this build');const dir=await mkdtemp(join(process.env.TMPDIR||tmpdir(),'kanvas-pdf-'));try{await writeFile(join(dir,'source.pdf'),pdf);const opts={cwd:dir,windowsHide:true,timeout:45000,maxBuffer:2*1024*1024,env:{...envMinimal(),KANVAS_RASTER:raster?'1':'0'}};const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],opts);const pages=JSON.parse(stdout.trim());let text=[],textAvailable=true;if(!raster){try{text=(await run('pdftotext',['-enc','UTF-8','source.pdf','-'],opts)).stdout.split('\f')}catch{textAvailable=false}}
let bytes=0;for(const [i,p] of pages.entries()){p.page=i+1;if(raster){const img=await readFile(join(dir,i+'.jpg'));bytes+=img.length;if(bytes>20*1024*1024||img.readUInt16BE(0)!==0xffd8)throw Error('Invalid or oversized raster');p.src='data:image/jpeg;base64,'+img.toString('base64')}else{p.text=(text[i]||'').trim().slice(0,1000);p.needsVisionFallback=!p.text}}
return {pageCount:pages.length,pages,textAvailable,isHybrid:false,needsVisionFallback:!raster&&pages.some(p=>p.needsVisionFallback)}}finally{await rm(dir,{recursive:true,force:true})}}
export async function inspectPdf(b){const d=extractHybridKanvas(b);return d?{pageCount:d.artboards.length,isHybrid:true,needsVisionFallback:false}:parse(b,false)}
export async function quickEditPdf(b){const {pages}=await parse(b,true);return {versi:1,judul:'PDF Quick Edit',artboards:pages.map(({w,h,page,src},i)=>({id:`a${page}`,nama:`Page ${page}`,x:pages.slice(0,i).reduce((x,p)=>x+p.w+160,0),y:0,w,h,bg:'#FFFFFF',elemen:[{id:`bg${page}`,nama:'PDF background',tipe:'gambar',x:0,y:0,w,h,src,fit:'contain',kunci:true}]}))}}
