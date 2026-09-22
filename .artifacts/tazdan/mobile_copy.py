from pathlib import Path
import re,json
p=Path('mobile/src/store/i18nStore.ts');s=p.read_text()
copy={
'en': {
'onboard.eyebrow.1':'ARAB ROOTS. GLOBAL REACH.',
'onboard.eyebrow.2':'CRYPTO AT THE CORE',
'onboard.eyebrow.3':'YOUR NEXT CHAPTER',
'onboard.title.1':'Your world. One wallet.',
'onboard.body.1':'From Libya to the wider Arab world: manage dinars, digital assets and everyday money in one familiar place.',
'onboard.title.2':'Crypto. People. Possibility.',
'onboard.body.2':'Hold supported crypto, trade P2P and send to the people who matter. See available routes and fees before you confirm.',
'onboard.title.3':'Connected with tazdan.',
'onboard.slogan':'Arab roots. Crypto at heart. Connected to the world.',
'onboard.feature.buySell':'Crypto, in your language',
'onboard.feature.buySellDesc':'Explore BTC, ETH, USDT and supported assets with an Arabic-first experience.',
'onboard.feature.realRate':'Clear quotes',
'onboard.feature.realRateDesc':'Review rates, network fees and transfer details before sending.',
'onboard.feature.transfer':'Closer across borders',
'onboard.feature.transferDesc':'Send by handle, chat, QR or supported wallet network. Routes depend on availability.',
'onboard.feature.cards':'Everyday money',
'onboard.feature.cardsDesc':'Keep your wallets, cards and spending together, wherever supported.',
'login.subtitle':'Your crypto, your wallets and your connections — together in tazdan.',
'home.noAssetsBody':'Add supported crypto or fund your wallet to get started.',
},
'ar': {
'onboard.eyebrow.1':'جذور عربية. آفاق عالمية.',
'onboard.eyebrow.2':'الكريبتو في قلب التجربة',
'onboard.eyebrow.3':'خطوتك القادمة',
'onboard.title.1':'عالمك. في محفظة واحدة.',
'onboard.body.1':'من ليبيا إلى العالم العربي: الدينار والأصول الرقمية وأموالك اليومية، في مكان واحد وبأسلوب مألوف.',
'onboard.title.2':'كريبتو. تواصل. فرص.',
'onboard.body.2':'احتفظ بالعملات المدعومة، وتداول بين الأفراد، وأرسل لمن يهمّك أمرهم. راجع الطرق المتاحة والرسوم قبل التأكيد.',
'onboard.title.3':'متصل بعالمك مع تزدان.',
'onboard.slogan':'جذور عربية. روح الكريبتو. تواصل مع العالم.',
'onboard.feature.buySell':'الكريبتو بلغتك',
'onboard.feature.buySellDesc':'اكتشف BTC وETH وUSDT والأصول المدعومة، بتجربة تبدأ بالعربية.',
'onboard.feature.realRate':'أسعار واضحة',
'onboard.feature.realRateDesc':'راجع سعر الصرف ورسوم الشبكة وتفاصيل التحويل قبل الإرسال.',
'onboard.feature.transfer':'أقرب رغم المسافات',
'onboard.feature.transferDesc':'أرسل بالمعرّف أو المحادثة أو رمز QR أو شبكة مدعومة، بحسب الطرق المتاحة.',
'onboard.feature.cards':'أموالك اليومية',
'onboard.feature.cardsDesc':'محافظك وبطاقاتك ومصروفاتك معاً، حيث تتوفر الخدمة.',
'login.subtitle':'الكريبتو ومحافظك وتواصلك مع الآخرين — كلّها مع تزدان.',
'home.noAssetsBody':'أضف عملة رقمية مدعومة أو موّل محفظتك لتبدأ.',
}}
start=s.index('const dict:')
for lang,entries in copy.items():
 a=s.index(f'  {lang}: {{',start); match=re.search(r'\n  (?:en|ar|fr|es|de|nl|ru|tr|zh): \{',s[a+5:]);b=a+5+match.start() if match else len(s)
 block=s[a:b]
 for key,value in entries.items():
  pattern=r"('"+re.escape(key)+r"':\s*)'(?:\\.|[^'\\])*'"
  block,n=re.subn(pattern,lambda m:m[1]+json.dumps(value,ensure_ascii=False),block)
  if n==0 and lang=='ar':
   block=block.replace('  ar: {', '  ar: {\n    '+json.dumps(key)+': '+json.dumps(value,ensure_ascii=False)+',',1)
  else: assert n==1,(lang,key,n)
 s=s[:a]+block+s[b:]
s=s.replace("locale: 'en',", "locale: 'ar',").replace("flag: '🇸🇦', rtl: false", "flag: '🇱🇾', rtl: false").replace("['en', 'ar', 'fr'", "['ar', 'en', 'fr'")
s=s.replace('Persists choice via AsyncStorage. Uses RTL flip for Arabic so the\n * onboarding/login layouts mirror correctly.', 'Arabic is the fresh-install default; saved language choices are preserved.\n * Arabic text direction is handled in shared Text components. Screen, chart\n * and numeric geometry stays stable when switching languages.')
p.write_text(s)
p=Path('mobile/src/constants/content.ts');s=p.read_text().replace('Money. Crypto. One app.', 'Arab roots. Crypto. Connected.').replace('Send, spend, and invest across fiat and crypto — anywhere in the world.', 'Bring everyday money and supported crypto together, from Libya to the wider Arab world.').replace('Your keys, your coins', 'Your crypto, connected').replace('Full custody of your crypto with bank-grade security on every transaction.', 'Manage supported assets and choose the correct network when sending or receiving.').replace('Instant P2P trading', 'Trade with people').replace('Buy and sell directly with verified traders at the best rates.', 'Explore P2P offers in LYD and regional currencies, with terms shown before you trade.')
s=s.replace("  USD: 'United States", "  LYD: 'Libyan Dinar — everyday money at home.',\n  USD: 'United States")
p.write_text(s)
