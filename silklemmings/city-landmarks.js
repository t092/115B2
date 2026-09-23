/* Decorative route landmarks only: no collisions, targets, or input handlers. */
(()=>{'use strict';
const files={'長安':'changan','玉門關':'yumenguan','大月氏':'yuezhi','大秦':'daqin'},images={};
for(const [name,file] of Object.entries(files)){const im=new Image();im.src=`assets/cities/${file}.png`;images[name]=im;}
function layout(route,width,forward){const size=width<600?Math.min(100,(width-16)/route.length):148,pad=size/2+8;return route.map((label,i)=>{const name=label.replace('（目標）',''),fraction=i/Math.max(1,route.length-1);return {name,label,x:pad+(width-2*pad)*(forward?fraction:1-fraction),size,image:images[name]};});}
function draw(ctx,route,width,ground,forward){for(const item of layout(route,width,forward)){const {name,label,x,size,image}=item,y=ground-72;ctx.save();if(image?.complete&&image.naturalWidth){ctx.drawImage(image,x-size/2,y-size,size,size);}else{ctx.textAlign='center';ctx.font=`bold ${width<600?18:23}px "Microsoft JhengHei",sans-serif`;ctx.lineWidth=4;ctx.strokeStyle='#fff7dd';ctx.fillStyle='#60452c';[...name].forEach((c,i)=>{const cy=y-size+28+i*(width<600?23:28);ctx.strokeText(c,x,cy);ctx.fillText(c,x,cy);});}if(label.includes('目標')){ctx.textAlign='center';ctx.font='13px "Microsoft JhengHei",sans-serif';ctx.fillStyle='#725c39';ctx.fillText('出使目標',x,y+12);}ctx.restore();}}
window.SilkCities={draw,layout,ready:()=>Object.values(images).every(im=>im.complete&&im.naturalWidth>0)};
})();
