from pathlib import Path
import json, zipfile, xml.etree.ElementTree as ET, hashlib
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent.parent
data=json.loads((ROOT/'model-results.json').read_text())
layout=json.loads((ROOT/'model-layout.json').read_text())
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
def close(actual,expected):
    assert actual is not None and abs(float(actual)-expected)<.005,(actual,expected)
book=ROOT/'Tazdan_Financial_Model_2026-11-10.xlsx'
with zipfile.ZipFile(book) as z:
    workbook=ET.fromstring(z.read('xl/workbook.xml'))
    names=[s.attrib['name'] for s in workbook.find('m:sheets',ns)]
    assert names==['Summary','Deal','Assumptions','Forecast','Checks','Sources'],names
    sheets={n:ET.fromstring(z.read(f'xl/worksheets/sheet{i+1}.xml')) for i,n in enumerate(names)}
    def cell(sheet,address):
        c=sheets[sheet].find(f'.//m:c[@r="{address}"]',ns)
        return c.findtext('m:v',None,ns) if c is not None else None
    errors=[]
    for name,s in sheets.items():
        errors.extend((name,c.attrib['r']) for c in s.findall('.//m:c',ns) if c.attrib.get('t')=='e')
    assert not errors,errors
    close(cell('Assumptions','D4'),2)
    base=data['scenarios'][1]
    for y,col in enumerate(['D','E','F']):
        a=base['annual'][y]
        for addr,k in [(11,'users'),(13,'business'),(14,'institutions'),(19,'revenue'),(26,'ebitda'),(29,'freeCash')]:close(cell('Summary',f'{col}{addr}'),a[k])
    close(cell('Summary','K12'),base['required18'])
    close(cell('Summary','K13'),base['required36'])
    for addr,expected in [('F13',650000),('F14',.33),('F16',650000/.33),('F17',650000/.33-600000),('F19',600000/(650000/.33)),('F20',50000/(650000/.33)),('H17',9000000/.33-5000000)]:close(cell('Deal',addr),expected)
    for c in sheets['Checks'].findall('.//m:c',ns):
        row=int(''.join(x for x in c.attrib['r'] if x.isdigit()))
        if (8<=row<=12 or c.attrib['r']=='D15') and c.find('m:f',ns) is not None and c.find('m:v',ns) is not None:close(c.findtext('m:v',None,ns),0)
    assert sheets['Assumptions'].find('.//m:dataValidation[@sqref="D4"]',ns) is not None
    assert not any(n.startswith('xl/externalLinks/') for n in z.namelist())
    assert 'xl/drawings/charts/chart1.xml' in z.namelist()

pdf=REPO/'output/pdf/Tazdan_Investment_Assessment_2026-11-10.pdf'
r=PdfReader(pdf)
assert len(r.pages)==16,len(r.pages)
texts=[p.extract_text() for p in r.pages]
assert all(len(t)>500 for t in texts)
assert '415' in texts[1] and '0 skipped' in texts[14]
assert '$229,355' in texts[8] and '($340,920)' in texts[8]
assert '$556,553' in texts[9] and '$1,265,477' in texts[9]
assert '$22,272,727' in texts[12]
assert all(f'E{i}.' in ''.join(texts[2:5]) for i in range(1,19))
links=[a.get_object().get('/A',{}).get('/URI') for a in r.pages[-1].get('/Annots',[])]
assert len([x for x in links if x])==11,links
for rel,digest in json.loads((ROOT/'evidence-metrics.json').read_text())['evidenceSha256'].items():
    assert hashlib.sha256((REPO/rel).read_bytes()).hexdigest()==digest,rel
v=json.loads((ROOT/'workbook-verification.json').read_text())
assert len(v['verification'])==3 and all(x['annualOutputsMatch'] and x['fundingMatch'] for x in v['verification'])
result={'pdfPages':len(r.pages),'primarySourceLinks':11,'xlsxCachedValuesMatch':True,'xlsxErrorCells':0,'activeCase':'Base','evidenceFilesUnchanged':True,'allScenariosIndependentlyReconciled':True,'nativeExcelApplicationTested':False,'pdfVisualReview':'All 16 pages reviewed; updated callouts/chart reviewed again','workbookVisualReview':'All six sheets reviewed, including late forecast and source ranges'}
(ROOT/'final-verification.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
