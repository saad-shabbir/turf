export type StickerPosition={x:number;y:number;scale:number};
export function fitSticker(position:StickerPosition,canvas:{width:number;height:number},size:{width:number;height:number}):StickerPosition{
 const width=Math.max(0,Number.isFinite(canvas.width)?canvas.width:0),height=Math.max(0,Number.isFinite(canvas.height)?canvas.height:0);
 const stickerWidth=Number.isFinite(size.width)&&size.width>0?size.width:1,stickerHeight=Number.isFinite(size.height)&&size.height>0?size.height:1;
 const max=Math.min(1.15,width/stickerWidth,height/stickerHeight);
 const desired=Number.isFinite(position.scale)?position.scale:.72;
 const scale=Math.max(Math.min(.35,max),Math.min(max,desired));
 return {scale,x:Math.max(0,Math.min(width-stickerWidth*scale,Number.isFinite(position.x)?position.x:0)),y:Math.max(0,Math.min(height-stickerHeight*scale,Number.isFinite(position.y)?position.y:0))};
}
