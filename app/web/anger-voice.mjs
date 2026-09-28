// 原创的圆润电子短哼：用谐波与下降音高表达轻微生气，不使用人声采样。
// 本文件及生成声音适用项目 MIT 许可。
export function synthesizeHmph(rate){
  const duration=.48,out=new Float32Array(Math.floor(rate*duration));
  let phase=0;
  for(let i=0;i<out.length;i++){
    const t=i/rate,progress=i/(out.length-1);
    const frequency=245-65*progress+7*Math.sin(Math.PI*progress);
    phase+=2*Math.PI*frequency/rate;
    const envelope=Math.sin(Math.PI*progress)**1.5;
    const body=Math.sin(phase)+.28*Math.sin(2*phase)+.13*Math.sin(3*phase);
    out[i]=.095*envelope*body*(.96+.04*Math.sin(2*Math.PI*14*t));
  }
  return out;
}
