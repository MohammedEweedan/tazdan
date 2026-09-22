from pathlib import Path
import zipfile, shutil
from lxml import etree as E
root=Path('/Users/moe/Downloads/promrkts')
fonts=Path.home()/'Library/Fonts';fonts.mkdir(exist_ok=True)
for weight in ['400Regular','700Bold']:
 src=root/f'mobile/node_modules/@expo-google-fonts/cairo/{weight}/Cairo_{weight}.ttf'
 dst=fonts/src.name
 if not dst.exists():shutil.copy2(src,dst)
p=root/'.artifacts/tazdan/candidate-ar.pptx'
ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
with zipfile.ZipFile(p) as z:files={n:z.read(n) for n in z.namelist()}
for name,data in list(files.items()):
 if name.startswith('ppt/slides/slide') and name.endswith('.xml'):
  node=E.fromstring(data)
  for para in node.findall('.//a:p',ns):
   pr=para.find('a:pPr',ns)
   if pr is None:pr=E.Element('{'+ns['a']+'}pPr');para.insert(0,pr)
   pr.set('rtl','1');pr.set('algn','r')
   for props in para.findall('.//a:rPr',ns)+para.findall('.//a:defRPr',ns)+para.findall('.//a:endParaRPr',ns):
    props.set('lang','ar-LY')
    for tag in ['latin','ea','cs']:
     f=props.find('a:'+tag,ns)
     if f is None:f=E.SubElement(props,'{'+ns['a']+'}'+tag)
     f.set('typeface','Cairo')
  files[name]=E.tostring(node,xml_declaration=True,encoding='UTF-8',standalone=True)
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:
 for n,data in files.items():z.writestr(n,data)
