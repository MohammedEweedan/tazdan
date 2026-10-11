"use client";
// TEMPORARY — kit smoke test; delete before shipping.
import { FiSend, FiShield, FiGlobe } from "react-icons/fi";
import {
  SiteShell, PageHero, Section, Container, SectionHeader, FeatureGrid, StoryScroll, PainList, Steps, FAQList, CTABand,
  SiteButton, RowList, Row, StatusChip, Stat, PhoneStage, useWaitlist,
} from "@/components/site";

function Inner() {
  const { open } = useWaitlist();
  return (
    <>
      <PageHero size="hero" eyebrow="Eyebrow line" title="The real rate. *Finally.*" lead="One account for dinars, dollars and digital assets, at the rate you actually get on the street."
        actions={<><SiteButton size="lg" onClick={open} arrow>Join the waitlist</SiteButton><SiteButton size="lg" variant="secondary" href="/features">Take the tour</SiteButton></>}
        note="Pre-launch." visual={<div style={{display:'flex',justifyContent:'center'}}><PhoneStage items={[{ screen: 'home', alt: 'Home screen' }]} index={0} w="300px" /></div>} />
      <Section rule><Container><SectionHeader eyebrow="Today" title="Money in Libya is *hard work.*" lead="Queues, two rates, and transfers that take a week." />
        <PainList items={[{ pain: '“The bank had no cash again.”', fix: 'Top up by transfer and spend from your phone.' }, { pain: 'Two rates and you get the worse one.', fix: 'The parallel rate, published live.' }]} /></Container></Section>
      <Section rule><Container><StoryScroll chapters={[
        { id: 'c1', pain: 'Sending money home means a week and a middleman.', eyebrow: 'Send', title: 'Pay anyone by *@handle.*', body: 'No IBAN, no phone number shared.', status: 'inApp', media: { video: 'flow-send', screen: 'send', alt: 'Send' } },
        { id: 'c2', eyebrow: 'Save', title: 'Goals that *fill themselves.*', body: 'Auto-contributions.', status: 'inApp', media: { screen: 'budgets', alt: 'Budgets' } },
        { id: 'c3', eyebrow: 'Abroad', title: 'Send abroad at a *locked quote.*', body: 'Corridors.', status: 'pilot', media: { screen: 'remit', alt: 'Remit' } },
      ]} /></Container></Section>
      <Section rule><Container><FeatureGrid items={[{ icon: FiSend, title: 'Send', body: 'Instant between users.', status: 'inApp' }, { icon: FiGlobe, title: 'Abroad', body: '12 corridors.', status: 'pilot' }, { icon: FiShield, title: 'Cards', body: 'Virtual and physical.', status: 'planned' }]} /></Container></Section>
      <Section rule><Container><Steps items={[{ title: 'Sign up', body: 'x' }, { title: 'Verify', body: 'y' }, { title: 'Move', body: 'z' }]} />
        <RowList panel mt="40px">{['inApp','pilot','planned','inProgress','discussion','pipeline'].map((s) => <Row key={s} padX="20px" icon={FiShield} title={s} body="Row body text" trailing={<StatusChip status={s as any} />} />)}</RowList>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:24,marginTop:40}}><Stat value="12" label="Corridors" /><Stat value="1:9.37" label="Rate" /><Stat value="24/7" label="Hours" /></div>
        <FAQList items={[{ q: 'Is it live?', a: 'Pre-launch.' }, { q: 'Where?', a: 'Libya first.' }]} /></Container></Section>
      <CTABand />
    </>
  );
}
export default function KitPreview() { return <SiteShell><Inner /></SiteShell>; }
