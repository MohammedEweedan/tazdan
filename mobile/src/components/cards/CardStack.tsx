import React, { useState } from 'react';
import styled, { keyframes, css } from 'styled-components';

/* ─── Types ─────────────────────────────────────────── */
type Tier = 'starter' | 'master' | 'pro';

interface CardConfig {
  tier: Tier;
  label: string;
  bg: string;
  bgGradient: string;
  shimmer: string;
  textColor: string;
  mutedColor: string;
  visaColor: string;
  logo: string; // filename token — swap for real <img> src
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

const CARDS: CardConfig[] = [
  {
    tier: 'starter',
    label: 'Starter',
    bg: '#7B8FE8',
    bgGradient: 'linear-gradient(135deg, #8fa3f5 0%, #6272d4 55%, #5060c0 100%)',
    shimmer: 'rgba(255,255,255,0.18)',
    textColor: '#ffffff',
    mutedColor: 'rgba(255,255,255,0.65)',
    visaColor: 'rgba(255,255,255,0.82)',
    logo: 'logo-white.png',
    number: '4242 4242 4242 4242',
    name: 'CARD HOLDER',
    expiry: '12 / 27',
    cvv: '•••',
  },
  {
    tier: 'master',
    label: 'Master',
    bg: '#2545C8',
    bgGradient: 'linear-gradient(135deg, #3558e8 0%, #1f3db5 55%, #182f9a 100%)',
    shimmer: 'rgba(255,255,255,0.12)',
    textColor: '#ffffff',
    mutedColor: 'rgba(255,255,255,0.6)',
    visaColor: 'rgba(255,255,255,0.80)',
    logo: 'logo-white.png',
    number: '4000 0000 0000 0001',
    name: 'CARD HOLDER',
    expiry: '12 / 27',
    cvv: '•••',
  },
  {
    tier: 'pro',
    label: 'Pro',
    bg: '#1a1f2e',
    bgGradient: 'linear-gradient(135deg, #2a3145 0%, #161b28 55%, #0e1119 100%)',
    shimmer: 'rgba(100,160,255,0.10)',
    textColor: '#e8f0ff',
    mutedColor: 'rgba(160,190,255,0.55)',
    visaColor: 'rgba(160,190,255,0.70)',
    logo: 'logo-white.png',
    number: '4000 0000 0000 0002',
    name: 'CARD HOLDER',
    expiry: '12 / 27',
    cvv: '•••',
  },
];

/* ─── Animations ─────────────────────────────────────── */
const flipIn = keyframes`
  from { transform: rotateY(0deg); }
  to   { transform: rotateY(180deg); }
`;
const flipOut = keyframes`
  from { transform: rotateY(180deg); }
  to   { transform: rotateY(0deg); }
`;

/* ─── Styled primitives ──────────────────────────────── */
const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  width: 100%;
  padding: 0;
  font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif;
`;

const TabRow = styled.div`
  display: flex;
  width: 100%;
  max-width: 360px;
  gap: 6px;
  padding: 0 0 14px 0;
`;

const Tab = styled.button<{ $active: boolean; $color: string }>`
  flex: 1;
  padding: 7px 0;
  border-radius: 20px;
  border: 1.5px solid ${({ $color }) => $color}55;
  background: ${({ $active, $color }) => $active ? $color : 'transparent'};
  color: ${({ $active }) => $active ? '#fff' : '#888'};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s;
`;

const Scene = styled.div`
  width: 100%;
  max-width: 360px;
  aspect-ratio: 1.586 / 1;
  perspective: 1200px;
`;

const CardInner = styled.div<{ $flipped: boolean }>`
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.65s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform: ${({ $flipped }) => $flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'};
`;

const Face = styled.div<{ $gradient: string; $shimmer: string }>`
  position: absolute;
  inset: 0;
  border-radius: 18px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  overflow: hidden;
  background: ${({ $gradient }) => $gradient};
  box-shadow:
    0 2px 4px rgba(0,0,0,0.18),
    0 12px 40px rgba(0,0,0,0.28),
    0 0 0 1px rgba(255,255,255,0.06) inset;

  /* subtle noise texture overlay */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 1;
  }

  /* diagonal shimmer */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      115deg,
      transparent 30%,
      ${({ $shimmer }) => $shimmer} 50%,
      transparent 70%
    );
    pointer-events: none;
    z-index: 1;
  }
`;

const BackFace = styled(Face)`
  transform: rotateY(180deg);
`;

/* Front layout */
const FrontContent = styled.div<{ $color: string }>`
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 5.5% 6%;
  color: ${({ $color }) => $color};
  box-sizing: border-box;
`;

const TopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const LogoMark = styled.div<{ $tier: Tier }>`
  font-size: 13px;
  font-weight: 800;
  letter-spacing: -0.3px;
  line-height: 1.15;

  span {
    display: block;
    font-size: 11px;
    font-weight: 700;
    opacity: 0.8;
    color: ${({ $tier }) => $tier === 'pro' ? '#60a0ff' : 'inherit'};
  }
`;

const TierBadge = styled.div<{ $muted: string }>`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: ${({ $muted }) => $muted};
  text-transform: uppercase;
  margin-top: 3px;
`;

const ChipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: auto;
  margin-bottom: 2%;
`;

const Chip = styled.div<{ $muted: string }>`
  width: 36px;
  height: 28px;
  border-radius: 5px;
  background: linear-gradient(135deg, #d4c9a8 0%, #b8a870 40%, #c8bc94 70%, #a89858 100%);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
  position: relative;
  overflow: hidden;

  /* chip lines */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(#0002 0px, transparent 1px, transparent 5px, #0002 5px, transparent 6px,
        transparent 10px, #0002 10px, transparent 11px, transparent 15px, #0002 15px, transparent 16px,
        transparent 20px, #0002 20px, transparent 21px, transparent 25px, #0002 25px, transparent 26px) 0 0 / 1px 100%,
      linear-gradient(90deg, #0002 0px, transparent 1px, transparent 8px, #0002 8px, transparent 9px,
        transparent 17px, #0002 17px, transparent 18px, transparent 26px, #0002 26px, transparent 27px) 0 0 / 100% 1px;
    opacity: 0.5;
  }

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 12px;
    height: 16px;
    border: 1px solid rgba(0,0,0,0.2);
    border-radius: 2px;
  }
`;

const Contactless = styled.div`
  width: 18px;
  height: 18px;
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;

  svg { width: 100%; height: 100%; }
`;

const NumberRow = styled.div<{ $muted: string }>`
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 2.5px;
  font-variant-numeric: tabular-nums;
  margin-bottom: 5%;
  color: inherit;
  opacity: 0.92;
`;

const BottomRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const CardMeta = styled.div<{ $muted: string }>`
  display: flex;
  flex-direction: column;
  gap: 1px;

  .label {
    font-size: 7px;
    letter-spacing: 0.8px;
    color: ${({ $muted }) => $muted};
    text-transform: uppercase;
  }
  .value {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 1px;
  }
`;

const VisaLogo = styled.div<{ $color: string }>`
  font-size: 20px;
  font-weight: 800;
  font-style: italic;
  letter-spacing: -1px;
  color: ${({ $color }) => $color};
  font-family: 'Times New Roman', serif;
  line-height: 1;
`;

/* Back */
const BackContent = styled.div`
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

const MagStripe = styled.div`
  width: 100%;
  height: 22%;
  margin-top: 14%;
  background: repeating-linear-gradient(
    45deg,
    #1a1a1a, #1a1a1a 8px,
    #111 8px, #111 16px
  );
`;

const CvvRow = styled.div`
  display: flex;
  align-items: center;
  padding: 5% 6% 0;
  gap: 8px;
`;

const SignatureStrip = styled.div`
  flex: 1;
  height: 28px;
  background: repeating-linear-gradient(
    -45deg,
    #f5f5f5, #f5f5f5 4px,
    #e8e8e8 4px, #e8e8e8 8px
  );
  border-radius: 3px;
`;

const CvvBox = styled.div`
  background: white;
  border-radius: 3px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  color: #111;
  letter-spacing: 3px;
  min-width: 44px;
  text-align: center;
`;

const BackVisa = styled.div<{ $color: string }>`
  align-self: flex-end;
  font-size: 18px;
  font-weight: 800;
  font-style: italic;
  letter-spacing: -1px;
  color: ${({ $color }) => $color};
  font-family: 'Times New Roman', serif;
  padding: 4% 6% 0;
`;

const HintText = styled.p`
  text-align: center;
  font-size: 10px;
  color: #555;
  margin-top: 10px;
  letter-spacing: 0.3px;
`;

/* ─── Sub-components ─────────────────────────────────── */
function ContactlessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" fillOpacity="0" />
      <path d="M7 12c0-2.76 2.24-5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M5 12c0-3.87 3.13-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M3 12C3 6.48 7.03 2 12 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.3"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  );
}

function SingleCard({ card }: { card: CardConfig }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div style={{ width: '100%', maxWidth: 360 }}>
      <Scene onClick={() => setFlipped(f => !f)} style={{ cursor: 'pointer' }}>
        <CardInner $flipped={flipped}>
          {/* FRONT */}
          <Face $gradient={card.bgGradient} $shimmer={card.shimmer}>
            <FrontContent $color={card.textColor}>
              <TopRow>
                <div>
                  <LogoMark $tier={card.tier}>
                    pro<br />
                    <span>mrkts</span>
                  </LogoMark>
                  <TierBadge $muted={card.mutedColor}>{card.label}</TierBadge>
                </div>
                <Contactless style={{ color: card.textColor }}>
                  <ContactlessIcon />
                </Contactless>
              </TopRow>

              <ChipRow>
                <Chip $muted={card.mutedColor} />
              </ChipRow>

              <NumberRow $muted={card.mutedColor}>
                {card.number}
              </NumberRow>

              <BottomRow>
                <CardMeta $muted={card.mutedColor}>
                  <span className="label">Card Holder</span>
                  <span className="value">{card.name}</span>
                </CardMeta>
                <CardMeta $muted={card.mutedColor} style={{ alignItems: 'flex-end' }}>
                  <span className="label">Expires</span>
                  <span className="value">{card.expiry}</span>
                </CardMeta>
                <VisaLogo $color={card.visaColor}>VISA</VisaLogo>
              </BottomRow>
            </FrontContent>
          </Face>

          {/* BACK */}
          <BackFace $gradient={card.bgGradient} $shimmer={card.shimmer}>
            <BackContent>
              <MagStripe />
              <CvvRow>
                <SignatureStrip />
                <CvvBox>{card.cvv}</CvvBox>
              </CvvRow>
              <BackVisa $color={card.visaColor}>VISA</BackVisa>
            </BackContent>
          </BackFace>
        </CardInner>
      </Scene>
    </div>
  );
}

/* ─── Main export ────────────────────────────────────── */
export default function CardStack() {
  const [active, setActive] = useState<Tier>('starter');
  const card = CARDS.find(c => c.tier === active)!;

  return (
    <Wrapper>
      <TabRow>
        {CARDS.map(c => (
          <Tab
            key={c.tier}
            $active={active === c.tier}
            $color={c.bg}
            onClick={() => setActive(c.tier)}
          >
            {c.label}
          </Tab>
        ))}
      </TabRow>

      <SingleCard key={active} card={card} />

      <HintText>Tap card to flip</HintText>
    </Wrapper>
  );
}