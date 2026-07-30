"""Mesure la hauteur réelle du contenu de chaque page contre la hauteur du cadre.

Le PDF ne signale pas ce qui déborde : Chromium coupe et se tait. On demande donc
au navigateur la position du dernier élément de chaque page."""
import json, os, re, subprocess
CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
JS = """
const out=[];
document.querySelectorAll('.page').forEach((p,i)=>{
  const pb=p.getBoundingClientRect();
  let low=pb.top;
  p.querySelectorAll('*').forEach(e=>{
    if(e.classList.contains('foot'))return;
    const r=e.getBoundingClientRect(); if(r.height&&r.bottom>low)low=r.bottom;
  });
  const f=p.querySelector('.foot');
  out.push([i, Math.round(low-pb.top), Math.round(pb.height),
            f?Math.round(f.getBoundingClientRect().top-pb.top):null]);
});
console.log(JSON.stringify(out));
"""
open('_probe.js','w').write(JS)
r=subprocess.run([CHROME,'--headless','--no-sandbox','--disable-gpu',
                  '--virtual-time-budget=5000',
                  '--dump-dom','file://'+os.path.abspath('note_bailleurs.html')],
                 capture_output=True,text=True)
# Chromium headless ne fait pas tourner de JS arbitraire en ligne de commande :
# on l'injecte dans une copie de la page.
dom=open('note_bailleurs.html').read()
open('_probe.html','w').write(dom.replace('</body>', f'<script>{JS}</script></body>'))
r=subprocess.run([CHROME,'--headless','--no-sandbox','--disable-gpu',
                  '--virtual-time-budget=5000','--enable-logging=stderr','--v=0',
                  '--dump-dom','file://'+os.path.abspath('_probe.html')],
                 capture_output=True,text=True)
m=re.findall(r'\[\[.*?\]\]', r.stderr)
if not m:
    print('pas de sortie ; stderr:', r.stderr[-800:]); raise SystemExit(1)
for i,low,h,ft in json.loads(m[-1]):
    flag=' <-- DÉBORDE' if ft and low>ft-4 else ''
    print(f'page {i:>2}  contenu {low:>5}  pied {ft}  cadre {h}{flag}')
