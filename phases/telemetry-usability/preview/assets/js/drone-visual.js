/* Illustrative two-arm deformation: strain is measured, pixel displacement is NOT. */
(()=>{'use strict';
 const el=id=>document.getElementById(id);
 const finite=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n))?Number(n):null;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const bands=[{name:'Lower',color:'#70c6a6'},{name:'Elevated',color:'#e1b86b'},{name:'High display',color:'#db8585'}];
 function updateArm(i,reading){
   const strain=finite(reading?.sensors?.['strain_arm_'+i]?.value);
   const vib=finite(reading?.sensors?.['vibration_'+i]?.value);
   const arm=el('armVisual'+i), line=el('armPath'+i),fill=el('armFill'+i),motor=el('motorGroup'+i);
   if(!arm||!line||!fill||!motor)return;
   const measured=strain!==null,abs=Math.abs(strain??0);
   // Clamp purely graphical deflection to at most 27 SVG units; no physical length mapping.
   const displacement=measured?clamp(abs/260,0,1)*27*(strain<0?-1:1):0;
   const left=i===1,x0=left?300:360,x1=left?160:500,cx=left?230:430;
   const endY=90+displacement, curveY=153+displacement*.35;
   const path=`M${x0} 199 Q${cx} ${curveY.toFixed(1)} ${x1} ${endY.toFixed(1)}`;
   line.setAttribute('d',path);fill.setAttribute('d',path);
   motor.setAttribute('transform',`translate(${x1} ${endY.toFixed(1)})`);
   const band=!measured?null:abs<100?0:abs<200?1:2;
   const color=band===null?'#8296a2':bands[band].color;
   arm.style.setProperty('--arm-color',color);
   // CSS oscillation is deliberately slow and exaggerated for readability; not actual accelerometer waveform.
   const shake=vib===null?0:clamp(vib/0.25,0,1)*2.6;
   arm.style.setProperty('--shake',shake.toFixed(2)+'px');
   arm.classList.toggle('is-vibrating',shake>.15);
   el('arm'+i+'Strain').textContent=measured?strain.toFixed(1):'—';
   el('arm'+i+'Vibration').textContent=vib===null?'—':vib.toFixed(4);
   el('arm'+i+'Level').textContent=band===null?'Unavailable':bands[band].name;
   el('arm'+i+'Mark').style.backgroundColor=color;
   el('arm'+i+'Meter').style.width=measured?clamp(abs/260,0,1)*100+'%':'0%';
   el('arm'+i+'Meter').style.backgroundColor=color;
 }
 window.SHMdrone={update(reading){updateArm(1,reading);updateArm(2,reading);}};
})();
