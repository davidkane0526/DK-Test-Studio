#!/usr/bin/env node
'use strict';
/*
 * Dependency-free native icon generator. One visual identity for:
 *  - Windows executable/NSIS/taskbar/task-manager icon (.ico, PNG-compressed frames)
 *  - Electron window icon
 *  - Android launcher and round icons at each density
 *
 * Deterministic graphics and file format, no downloaded assets or font files.
 */
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const root=path.resolve(__dirname,'..');

function distance(px,py,ax,ay,bx,by){
  const vx=bx-ax,vy=by-ay;
  const t=Math.max(0,Math.min(1,((px-ax)*vx+(py-ay)*vy)/(vx*vx+vy*vy)));
  return Math.hypot(px-ax-t*vx,py-ay-t*vy);
}
function arcSegments(){
  const lines=[];
  let last=null;
  for(let i=0;i<=36;i++){
    const t=-Math.PI/2+(Math.PI*i/36);
    const pos=[0.344+0.182*Math.cos(t),0.5+0.212*Math.sin(t)];
    if(last)lines.push([...last,...pos]);
    last=pos;
  }
  return lines;
}
const dLines=[
  [0.219,0.288,0.219,0.712],
  [0.219,0.288,0.344,0.288],
  [0.219,0.712,0.344,0.712],
  ...arcSegments()
];
const kLines=[
  [0.613,0.288,0.613,0.712],
  [0.613,0.515,0.835,0.288],
  [0.613,0.507,0.849,0.712]
];
const aLines=[[0.275,0.808,0.453,0.808],[0.453,0.808,0.491,0.781],
  [0.491,0.781,0.526,0.828],[0.526,0.828,0.561,0.808],[0.561,0.808,0.746,0.808]];
function strokeDistance(lines,x,y){
  let min=10;
  for(const [ax,ay,bx,by] of lines)min=Math.min(min,distance(x,y,ax,ay,bx,by));
  return min;
}
function smooth(edge,halfWidth){
  return Math.max(0,Math.min(1,(halfWidth-edge)*240));
}
function roundedRectSignedDistance(x,y){
  const radius=0.185,half=.492,center=.5;
  const qx=Math.abs(x-center)-(half-radius);
  const qy=Math.abs(y-center)-(half-radius);
  return Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-radius;
}
function draw(size){
  const px=Buffer.alloc(size*size*4);
  function over(idx,color,alpha){
    const a=Math.max(0,Math.min(1,alpha));
    if(a<=0)return;
    const old=px[idx+3]/255;
    const out=a+old*(1-a);
    if(out<=0)return;
    for(let n=0;n<3;n++)px[idx+n]=Math.round(
      (color[n]*a+px[idx+n]*old*(1-a))/out);
    px[idx+3]=Math.round(255*out);
  }
  const aa=Math.min(.028,1.2/size);
  const opacity=(dist,range)=>Math.max(0,Math.min(1,(range+aa-dist)/(2*aa)));
  for(let yy=0;yy<size;yy++){
    const y=(yy+.5)/size;
    for(let xx=0;xx<size;xx++){
      const x=(xx+.5)/size,i=(yy*size+xx)*4;
      const shape=opacity(roundedRectSignedDistance(x,y),0);
      if(shape<=0)continue;
      const glow=Math.exp(-((x-.85)**2+(y-.18)**2)/.09);
      const bg=[Math.round(12+11*(1-y)+9*glow),
        Math.round(28+12*(1-y)+12*glow),
        Math.round(57+24*(1-y)+21*glow)];
      over(i,bg,shape);
      const borderAlpha=Math.max(0,Math.min(1,(.018-Math.abs(roundedRectSignedDistance(x,y)+.006))/aa));
      over(i,[77,116,166],.35*shape*borderAlpha);
      over(i,[237,246,255],opacity(strokeDistance(dLines,x,y),.029)*shape);
      over(i,[77,222,246],opacity(strokeDistance(kLines,x,y),.029)*shape);
      over(i,[81,168,211],opacity(strokeDistance(aLines,x,y),.008)*shape*.85);
    }
  }
  return px;
}
let crcTable;
function crc32(data){
  if(!crcTable){
    crcTable=new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):(c>>>1);
      crcTable[n]=c>>>0;
    }
  }
  let c=0xffffffff;
  for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
function chunk(type,body){
  const typeBytes=Buffer.from(type,'ascii');
  const length=Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const checksum=Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes,body])));
  return Buffer.concat([length,typeBytes,body,checksum]);
}
function png(size){
  const pixels=draw(size);
  const raw=Buffer.alloc((size*4+1)*size);
  for(let row=0;row<size;row++)
    pixels.copy(raw,row*(size*4+1)+1,row*size*4,(row+1)*size*4);
  const header=Buffer.alloc(13);
  header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);
  header[8]=8;header[9]=6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),
    chunk('IDAT',zlib.deflateSync(raw,{level:9})),
    chunk('IEND',Buffer.alloc(0))
  ]);
}
function icon(frames){
  const count=frames.length,header=Buffer.alloc(6+16*count);
  header.writeUInt16LE(1,2);header.writeUInt16LE(count,4);
  let offset=header.length;
  for(let n=0;n<count;n++){
    const {size,bytes}=frames[n],i=6+n*16;
    header[i]=size===256?0:size;
    header[i+1]=size===256?0:size;
    header[i+2]=0;header[i+3]=0;
    header.writeUInt16LE(1,i+4);
    header.writeUInt16LE(32,i+6);
    header.writeUInt32LE(bytes.length,i+8);
    header.writeUInt32LE(offset,i+12);
    offset+=bytes.length;
  }
  return Buffer.concat([header,...frames.map(frame=>frame.bytes)]);
}
function build(){
  const buildDir=path.join(root,'build');
  fs.mkdirSync(buildDir,{recursive:true});
  const sizes=[16,24,32,48,64,128,256];
  const frames=sizes.map(size=>({size,bytes:png(size)}));
  const nativeIcon=path.join(buildDir,'icon.ico');
  fs.writeFileSync(nativeIcon,icon(frames));
  fs.writeFileSync(path.join(buildDir,'icon.png'),frames[frames.length-1].bytes);
  // Prevent releasing a shell when the embedded Windows icon was not generated.
  if(fs.statSync(nativeIcon).size<2048)throw Error('Generated Windows icon is unexpectedly small');
  const density=[['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]];
  for(const [name,size] of density){
    const dest=path.join(root,'android','app','src','main','res','mipmap-'+name);
    fs.mkdirSync(dest,{recursive:true});
    const bytes=png(size);
    fs.writeFileSync(path.join(dest,'ic_launcher.png'),bytes);
    fs.writeFileSync(path.join(dest,'ic_launcher_round.png'),bytes);
  }
  process.stdout.write('Generated DK Test Studio native icons: multi-resolution .ico, Electron .png, Android mipmap launcher assets\n');
  return {frames:sizes,densities:density.map(([name])=>name)};
}
if(require.main===module)build();
module.exports={build,png,icon};
