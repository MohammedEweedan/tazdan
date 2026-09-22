import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { finalizePresentation } from '/Users/moe/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root='/Users/moe/Downloads/promrkts', tmp=path.join(root,'.artifacts/tazdan');
const skill='/Users/moe/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
for(const weight of ['400Regular','700Bold']) GlobalFonts.registerFromPath(path.join(root,`mobile/node_modules/@expo-google-fonts/cairo/${weight}/Cairo_${weight}.ttf`),'Cairo');
const family='Cairo';
const model=JSON.parse(await fs.readFile(path.join(tmp,'model.json'),'utf8'));
const sources=model.sources.map(s=>`${s[0]}: ${s[1]}\n${s[2]}\n${s[3]}`).join('\n\n');
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={bg:'#16181C',white:'#F5F6F8',blue:'#63A1DB',muted:'#AEB9C7',ink:'#192737',light:'#F7F9FC'};
function text(s,content,x,y,w,h,size=26,color=C.white,bold=false){
 const box=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 box.text=content;box.text.style={typeface:family,fontSize:size,color,bold,alignment:'right',autoFit:'none',insets:{top:0,bottom:0,left:0,right:0}};return box;
}
function slide(title,light=false,sub=''){
 const s=p.slides.add();s.background.fill=light?C.light:C.bg;s._light=light;
 if(title)text(s,title,68,45,1144,100,43,light?C.ink:C.white,true);
 if(sub)text(s,sub,70,151,1140,65,22,light?'#586879':C.muted);
 text(s,'tazdan',1010,674,200,25,16,C.blue,true);text(s,String(p.slides.items.length).padStart(2,'0'),70,674,45,25,15,C.blue);
 return s;
}
function row(s,label,body,y){text(s,label,895,y,315,85,25,s._light?C.ink:C.blue,true);text(s,body,70,y,770,108,25,s._light?'#4B5B6C':C.white);}
function note(s,value){s.speakerNotes.textFrame.setText(value);}
function table(s,values,y,widths,font=24){
 const v=values.map(r=>[...r].reverse());
 const t=s.tables.add({rows:v.length,columns:v[0].length,left:70,top:y,width:1140,height:v.length*55,columnWidths:[...widths].reverse(),values:v});
 t.cells.block({row:0,column:0,rowCount:v.length,columnCount:v[0].length}).assign({fill:s._light?'#FFFFFF':'#20252D',textStyle:{typeface:family,fontSize:font,alignment:'right',color:s._light?C.ink:C.white},margins:{left:16,right:16,top:8,bottom:8}});
 t.cells.block({row:0,column:0,rowCount:1,columnCount:v[0].length}).assign({fill:s._light?'#E4EDF6':'#293749',textStyle:{typeface:family,fontSize:font,alignment:'right',bold:true,color:s._light?C.ink:C.blue}});
 t.borders.assign({fill:s._light?'#D8E1EA':'#35404C',width:.6});return t;
}
let s=slide('');
s.images.add({blob:await fs.readFile(path.join(root,'client/public/text-logo-color.png')),contentType:'image/png',alt:'شعار تزدان الأصلي',fit:'contain',position:{left:905,top:60,width:305,height:95}});
text(s,'ليبيا. كريبتو.\nعالم أقرب.',100,220,1110,225,73,C.white,true);
text(s,'جذور عربية. أصول رقمية. تحويلات دولية.\nتجربة مالية واحدة تربطك بعالمك.',160,473,1050,108,30,C.muted);
text(s,'عرض استثماري  /  سبتمبر 2026  /  مرحلة ما قبل الإطلاق',70,610,1140,40,21,C.blue);
note(s,'مشروع في مرحلة التخطيط. لا يفترض هذا العرض وجود ترخيص أو شراكات موقّعة أو عملاء فعليين. جميع المبالغ بالدينار الليبي، والأرقام المالية افتراضات للتخطيط.');

s=slide('المال اليومي يحتاج تجربة أبسط',false,'فرضية نختبرها مع المستهلكين والتجار في ليبيا');
row(s,'للأفراد','المصروف اليومي، دعم العائلة، وأهداف الادخار؛ كلّها واضحة في تطبيق واحد.',252);
row(s,'للتجار','استلام المال هو البداية. تسوية واضحة وسجل مبيعات مفيد يصنعان الفرق.',395);
text(s,'أول خطوة للتحقق: مقابلة 100 مستهلك و30 تاجراً.',70,575,1140,65,26,C.blue);
note(s,'احتياجات العملاء هنا فرضيات بحثية، وليست نتائج دراسة ميدانية مكتملة. يلزم التحقق قبل تثبيت النطاق والتسعير.');

s=slide('ليبيا تمتلك بالفعل بنية للدفع الرقمي',true,'مؤشرات تاريخية من مصرف ليبيا المركزي حتى نوفمبر 2025');
text(s,'328.0 مليار',580,245,630,110,79,C.ink,true);
text(s,'دينار ليبي قيمة المدفوعات الإلكترونية\nمن يناير إلى نوفمبر 2025',595,375,615,110,28,'#566778');
text(s,'150,019',70,250,365,85,55,C.blue,true);text(s,'جهاز نقطة بيع',70,342,365,55,25,C.ink);
text(s,'183,435',70,440,365,85,55,C.blue,true);text(s,'محفظة إلكترونية',70,532,365,55,25,C.ink);
text(s,'مقاييس مختلفة؛ لا تُجمع كسوق واحدة ولا تمثل عدد مستخدمين فريدين.',70,616,1140,45,21,'#647283');
note(s,'المصدر S3، الصفحة 6. بيانات وطنية تاريخية، وليست أرقام تزدان أو حجم السوق الحالي.\n'+sources);

s=slide('الدينار والكريبتو، جنباً إلى جنب',false,'تجربة تبدأ بالعربية وتربط الحياة في ليبيا بالعالم');
text(s,'ادفع محلياً',610,245,600,70,33,C.blue,true);
text(s,'محفظة بالدينار، إيصالات واضحة، ومدفوعات للأفراد والتجار.',600,321,610,95,28);
text(s,'تواصل عبر الحدود',600,448,610,65,33,C.blue,true);
text(s,'أصول رقمية مدعومة، تحويلات للعائلة، وأموالك اليومية في تجربة مألوفة.',595,523,615,102,27);
s.images.add({blob:await fs.readFile(path.join(root,'client/public/screenshots/tazdan/IMG_2134.PNG')),contentType:'image/png',alt:'لقطة من تطبيق تزدان الأصلي',fit:'contain',position:{left:180,top:195,width:235,height:430}});
text(s,'واجهة توضيحية؛ الأرصدة القديمة ليست عرضاً حياً.',75,635,480,25,14,C.muted);
note(s,'حُفظت لقطة التطبيق الأصلية كما هي. المدفوعات المحلية هي أساس النموذج المالي، بينما يتطلب الكريبتو والتحويل الدولي موافقات مستقلة.');

s=slide('رؤية واحدة، وتنفيذ على مراحل',true);
row(s,'تجربة محلية محدودة','عملاء موثّقون، محفظة بالدينار، مدفوعات للتجار، إيصالات ودعم.',230);
row(s,'توسّع محلي','روابط دفع ورموز QR، جيوب ادخار وتقارير أفضل بعد نجاح التجربة.',368);
row(s,'كريبتو وتحويلات','أصول مدعومة وتحويلات دولية بعد استيفاء المتطلبات القانونية وموافقات الشركاء والممرات.',505);
note(s,'المراحل مقترحة. لا تعني صلاحية الدفع المحلي صلاحية تقديم الحفظ أو التحويل الدولي أو العملات الرقمية.\n'+sources);

s=slide('الانتشار يبدأ بالاستخدام المحلي',false,'طرابلس وبنغازي سوقان مقترحان للتجربة الأولى');
row(s,'تجمعات التجار','ابدأ بمتاجر الأحياء والمطاعم. درّب التجار وأثبت انتظام التسوية.',235);
row(s,'العملاء اليوميون','الوصول عبر جهات العمل والمجتمعات وإحالات التجار، مع التحقق من الهوية.',365);
row(s,'الدليل قبل التوسّع','هدف تجريبي: من 1,000 إلى 2,000 عميل نشط، ومن 50 إلى 100 تاجر نشط.',500);
note(s,'المدن والأهداف افتراضات تخطيطية. ميزانية التسويق وحدها لا تكفي لتحقيق التوسع المفترض؛ يجب إثبات قنوات الشركاء والاحتفاظ العضوي.');

s=slide('تسعير مقترح وواضح بالدينار',true,'الاشتراكات منفصلة عن رسوم المعالجة والخدمات الأخرى');
table(s,[['الباقة','شهرياً بالدينار','الغرض'],['اليومية','0','المحفظة والمدفوعات المحلية'],['بلس','15','جيوب ادخار ودعم بالأولوية'],['الأعمال','49','طلبات دفع وتقارير للتجار']],245,[250,230,660],25);
text(s,'أسعار مقترحة للإطلاق. الرسوم والحدود والأهلية تحتاج تأكيداً.',70,553,1140,70,25,'#586879');
note(s,'الأسعار متسقة مع الموقع ودراسة الجدوى. الانضمام إلى قائمة الانتظار مجاني. هذه ليست تعرفة معتمدة لخدمة حية.');

s=slide('المسار التنظيمي هو البوابة الأولى',false,'الشريك المرخّص جزء من المسار، ولا يغني وحده عن موافقات المشروع');
row(s,'قبل أموال العملاء','تأكيد نطاق الترخيص، حماية الأموال، حسابات التسوية وشروط العملاء.',235);
row(s,'قبل الإطلاق العام','اعتماد التحقق من الهوية، مراقبة العمليات، الشكاوى والفحص الأمني المستقل.',365);
row(s,'قبل الوصول الدولي','تأكيد أهلية المُصدر ومتطلبات الصرف وكل ممر تحويل مدعوم.',495);
note(s,'لا تحدد المصادر العامة الترخيص الدقيق لتزدان أو رسومه أو رأسماله. يلزم رأي قانوني محلي حديث وتأكيد مكتوب من الجهات والشركاء.\n'+sources);

s=slide('ميزانية حذرة لمدة 24 شهراً',true,'الإنفاق الثابت بمليون دينار. تقديرات تخطيطية وليست عروض موردين.');
table(s,[['مجال الإنفاق','مليون دينار'],['الهندسة وتطوير المنتج','3.60'],['فريق التشغيل والامتثال','4.80'],['القانون والأمن وتجهيز الشركاء','3.30'],['السحابة والنمو والإدارة','3.30'],['إجمالي الإنفاق الثابت','15.00']],230,[880,260],25);
note(s,'القانون والترخيص 1.50، الأمن 0.90، تكامل الشركاء 0.90 = 3.30 مليون. السحابة 1.20، النمو 1.50، الإدارة 0.60 = 3.30 مليون. السنة الأولى 8.40 والثانية 6.60 مليون.');

s=slide('غلاف تمويلي أساسي: 30 مليون دينار',false,'الاحتياطي والأموال المقيّدة يظهران بصورة مستقلة');
table(s,[['استخدام التمويل','مليون دينار'],['إنفاق ثابت لمدة 24 شهراً','15.00'],['احتياطي تكاليف بنسبة 35%','5.25'],['مخصص رأسمال تنظيمي مبدئي','5.00'],['ضمانات الشركاء أو التسوية','2.00'],['سيولة إضافية غير مقيّدة','2.75'],['إجمالي التمويل المقترح','30.00']],218,[880,260],23);
note(s,'مخصص رأسمال 5 ملايين ليس حداً قانونياً مؤكداً. رأس المال والضمانات مخصصات في الميزانية وليست مصروفات تشغيلية. أموال العملاء ليست تمويلاً للشركة.');

s=slide('الربحية التشغيلية تحتاج حجماً كافياً',true,'سيناريو أساسي افتراضي؛ الأرقام بمليون دينار ما لم يُذكر غير ذلك.');
table(s,[['المؤشر السنوي','السنة 1','السنة 2','السنة 3'],['متوسط العملاء النشطين','10,000','45,000','120,000'],['الإيرادات','0.730','4.709','17.310'],['تكاليف الخدمة المتغيرة','0.420','2.202','6.780'],['الإنفاق الثابت','8.400','6.600','8.400'],['النتيجة التشغيلية','−8.090','−4.093','+2.130']],230,[540,200,200,200],23);
text(s,'قبل الضرائب والتمويل والسحب من الاحتياطي. دون إيرادات دولية.',70,627,1140,37,20,'#637082');
note(s,'متوسطات العملاء سنوية. نسب بلس 10% و15% و20%؛ التجار 200 و800 و2500؛ الإنفاق الشهري 600 و800 و1000 دينار؛ العائد الإجمالي 0.6% و0.7% و0.8%. تكلفة المعالجة والخسائر 0.3%، خدمة العميل 1.5 دينار شهرياً وخدمة التاجر 10 دنانير.');

s=slide('التجربة هي اختبار اقتصاديات المشروع',false);
text(s,'6.50 دينار',535,240,675,110,76,C.blue,true);
text(s,'مساهمة شهرية لكل عميل نشط\nوفق افتراضات النضج في السنة الثالثة',545,372,665,105,28);
text(s,'92,693',70,263,360,100,62,C.white,true);
text(s,'متوسط العملاء النشطين\nاللازم للتعادل التشغيلي',70,385,370,130,26,C.muted);
text(s,'بافتراض 2,500 تاجر وإنفاق ثابت شهري قدره 700,000 دينار.',70,575,1140,65,25,C.muted);
note(s,'مساهمة العميل = 1000×0.008 + 0.20×15 −1000×0.003 −1.5 =6.5 دينار. مساهمة التاجر =49−10=39 دينار. التعادل =(700000−2500×39)÷6.5، ويقرّب إلى 92693 عميلاً. لا تشمل المساهمة كلفة الاستحواذ أو الضرائب.');

s=slide('مساحة للتأخير، وليست ميزانية مفتوحة',true);
row(s,'صدمة التكلفة','تأخير ستة أشهر: 3.75 مليون. صدمة الموردين والصرف: 1.50 مليون. معاً تستهلكان احتياطي 5.25 مليون دينار.',230);
row(s,'ضعف الطلب','عند 60,000 عميل نشط وإيرادات أضعف، تخسر السنة الثالثة 6.951 مليون دينار.',382);
row(s,'مخاطر التسوية','تمويل يومين مقدماً عند حجم السنة الثالثة يحتاج نحو 7.89 مليون دينار. يلزم تعديل الاحتياطي الأولي.',525);
note(s,'تأخير: 625 ألفاً شهرياً ×6. صدمة موردين: 25% على 40% من 15 مليون. السيناريو الضعيف: إيراد 4.407 وتكاليف متغيرة 2.958 وثابتة 8.4 مليون. التسوية: 1.44 مليار ÷365×2.');

s=slide('توسّع الكريبتو والتحويل الدولي',false,'ميزانية اختيارية منفصلة عن الغلاف المحلي الأساسي');
text(s,'4.05 مليون',555,240,655,110,73,C.blue,true);
text(s,'دينار: 3.00 ملايين للتجهيز والتخصصات\nبالإضافة إلى احتياطي بنسبة 35%',530,373,680,110,27);
text(s,'34.05 مليون',70,270,380,85,44,C.white,true);
text(s,'دينار للغلاف التخطيطي المجمع\nقبل أي رأسمال أجنبي أو\nسيولة إضافية غير مسعّرة',70,380,390,132,24,C.muted);
text(s,'حفظ الأصول، فحص العمليات، استشارات الممرات، الأمن وتكامل الدفع.',70,558,1140,60,25,C.muted);
text(s,'الإطلاق مشروط بالقانون الحالي والشركاء المتعاقدين.',70,625,1140,38,22,C.blue);
note(s,'المخصصات بالمليون: حفظ ومحافظ 0.45؛ تحليل السلسلة وقاعدة السفر 0.60؛ قانون وفحص الشركاء 0.75؛ أمن 0.60؛ تكامل مدفوعات 0.60. المجموع 3.00 +35%=4.05. خمسة آلاف تحويل شهري بمتوسط ألف دينار ورسوم 1.5% وكلفة 0.9% ودينارين للتحويل تعطي مساهمة 20 ألف دينار قبل الثابت؛ لا تبرر وحدها الاستثمار. الوضع القانوني الحالي للكريبتو في ليبيا غير مثبت.\n'+sources);

s=slide('التمويل يتبع الدليل',false,'دفعات استثمار مقترحة ضمن الغلاف الأساسي البالغ 30 مليون دينار');
row(s,'5 ملايين دينار','بحث العملاء، الاستشارة المحلية، اختيار الشركاء والهندسة الأولية.',235);
row(s,'10 ملايين دينار','بعد إثبات المسار التنظيمي وتسعير الشراكات واعتماد التصميم التقني.',365);
row(s,'15 مليون دينار','بعد قبول الأمن والسماح بالتجربة وتأكيد متطلبات رأس المال.',495);
text(s,'30 مليوناً للأساس + 4.05 ملايين اختيارية للكريبتو والتحويلات.',70,616,1140,47,24,C.blue);
note(s,'الدفعات مقترحة وليست التزامات تمويلية. لا تُقبل أموال العملاء قبل اكتمال النطاق المعتمد وضوابط حماية الأموال. الأرقام والنماذج المفصلة في دراسة الجدوى المصاحبة.\n'+sources);

const renderDir=path.join(tmp,'deck-ar-render');await fs.mkdir(renderDir,{recursive:true});
const candidate=path.join(tmp,'candidate-ar.pptx');await(await PresentationFile.exportPptx(p)).save(candidate);
for(let i=0;i<p.slides.items.length;i++){
 const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(path.join(renderDir,`slide-${i+1}.png`),new Uint8Array(await b.arrayBuffer()));
}
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(root,'deliverables/tazdan-pitch-deck-ar.pptx'),pythonExecutable:'/Users/moe/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...[7,9,10,11].flatMap(n=>['--require-native-table-slide',String(n)])],requiredNativeTableOwnerSlides:[7,9,10,11],fontPolicy:{basis:'user_request',families:[family],scriptFonts:{cs:family}},verifyArtifactToolImport:true,receiptPath:path.join(tmp,'deck-ar-validation.json')});console.log(result.finalPath);
