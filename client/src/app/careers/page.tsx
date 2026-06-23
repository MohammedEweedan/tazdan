"use client";

import {
  Box,
  Button,
  HStack,
  Icon,
  SimpleGrid,
  Text,
  VStack,
  useColorMode,
} from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import {
  FiAward,
  FiBriefcase,
  FiClock,
  FiDollarSign,
  FiGlobe,
  FiMapPin,
  FiSend,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from "react-icons/fi";
import PublicNav from "@/components/ui/PublicNav";
import PublicFooter from "@/components/ui/PublicFooter";
import { publicPageTheme } from "@/components/ui/publicPageTheme";
import {
  Band,
  BentoCard,
  CTASection,
  Em,
  PageHero,
  SectionHeading,
  useAppleLocale,
} from "@/components/ui/appleKit";

const BENEFITS = [
  { icon: FiDollarSign, title: "Competitive salary", titleAr: "راتب تنافسي", desc: "Compensation that respects the level of ambition and responsibility we expect.", descAr: "تعويض يحترم مستوى الطموح والمسؤولية التي نتوقعها." },
  { icon: FiAward, title: "Real ownership", titleAr: "ملكية حقيقية", desc: "Equity for the people building the product, not just watching it happen.", descAr: "حصة للذين يبنون المنتج فعلاً، لا يراقبون حدوثه فقط." },
  { icon: FiClock, title: "Focused pace", titleAr: "سرعة بتركيز", desc: "Async when it helps, fast decisions when they matter, and fewer performative meetings.", descAr: "عمل غير متزامن عندما يفيد، وقرارات سريعة عندما يهم الأمر، واجتماعات أقل بلا استعراض." },
  { icon: FiTarget, title: "Career slope", titleAr: "مسار نمو واضح", desc: "Clear growth paths for people who want to build rare judgment, not just ship tickets.", descAr: "مسارات نمو واضحة لمن يريدون بناء حكم نادر، لا مجرد إنجاز مهام." },
  { icon: FiUsers, title: "Small, sharp teams", titleAr: "فرق صغيرة وحادة", desc: "Work directly with people who care about craft, safety, and financial access.", descAr: "اعمل مباشرة مع أشخاص يهتمون بالحرفة والأمان والوصول المالي." },
  { icon: FiGlobe, title: "Remote-friendly", titleAr: "مناسب للعمل عن بُعد", desc: "Build from wherever you do your best work, with an optional Tripoli hub.", descAr: "ابنِ من المكان الذي تعمل فيه بأفضل شكل، مع مركز اختياري في طرابلس." },
];

const VALUES = [
  { icon: FiShield, title: "Trust is product", titleAr: "الثقة هي المنتج", desc: "Security, compliance, and clarity are not afterthoughts. They are the thing.", descAr: "الأمان والامتثال والوضوح ليست إضافات لاحقة. هي جوهر المنتج." },
  { icon: FiZap, title: "Move with taste", titleAr: "تحرّك بذوق", desc: "Fast is only useful when the work is precise, useful, and durable.", descAr: "السرعة مفيدة فقط عندما يكون العمل دقيقاً ونافعاً وقابلاً للبقاء." },
  { icon: FiTrendingUp, title: "Own the outcome", titleAr: "امتلك النتيجة", desc: "We hire people who can hold the whole problem, not just their slice of it.", descAr: "نوظف من يستطيعون حمل المشكلة كاملة، لا جزءهم منها فقط." },
];

const POSITIONS = [
  { title: "Senior Frontend Engineer", titleAr: "مهندس واجهات أول", dept: "Engineering", deptAr: "الهندسة", loc: "Remote / Tripoli", locAr: "عن بُعد / طرابلس", exp: "5+ yrs", expAr: "+5 سنوات", skills: ["React", "TypeScript", "Next.js", "Design systems"] },
  { title: "Backend Engineer", titleAr: "مهندس خلفية", dept: "Engineering", deptAr: "الهندسة", loc: "Tripoli", locAr: "طرابلس", exp: "3+ yrs", expAr: "+3 سنوات", skills: ["Node.js", "PostgreSQL", "API design", "Security"] },
  { title: "Product Manager", titleAr: "مدير منتج", dept: "Product", deptAr: "المنتج", loc: "Remote", locAr: "عن بُعد", exp: "3+ yrs", expAr: "+3 سنوات", skills: ["Fintech", "Discovery", "Analytics", "Execution"] },
  { title: "Compliance & AML Officer", titleAr: "مسؤول امتثال وAML", dept: "Compliance", deptAr: "الامتثال", loc: "Tripoli", locAr: "طرابلس", exp: "2+ yrs", expAr: "+2 سنوات", skills: ["AML/KYC", "Risk", "Regulation", "Audits"] },
  { title: "Customer Support Specialist", titleAr: "أخصائي دعم العملاء", dept: "Support", deptAr: "الدعم", loc: "Remote", locAr: "عن بُعد", exp: "1+ yrs", expAr: "+1 سنة", skills: ["Support", "Crypto", "Bilingual", "Ops"] },
  { title: "Growth & Marketing Manager", titleAr: "مدير النمو والتسويق", dept: "Growth", deptAr: "النمو", loc: "Remote", locAr: "عن بُعد", exp: "4+ yrs", expAr: "+4 سنوات", skills: ["Growth", "Lifecycle", "Content", "Data"] },
];

export default function CareersPage() {
  const { t } = useTranslate();
  const { isAr } = useAppleLocale();
  const { colorMode } = useColorMode();
  const dark = colorMode === "dark";
  const {
    pageBg,
    textMain,
    textSub,
    cardBg,
    cardBgHover,
    cardBorder,
    strongBorder,
    accent,
    accentText,
    accentSoft,
    accentBorder,
  } = publicPageTheme(dark);
  const copy = (en: string, ar: string) => (isAr ? ar : en);

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      <PageHero
        eyebrow={t("nav_careers")}
        title={
          <>
            {copy("Build the future of ", "ابنِ مستقبل ")}
            <Em>{copy("money", "المال")}</Em>
          </>
        }
        subtitle={copy(
          "Join the team building the financial layer where money, crypto, and local currency finally move as one.",
          "انضم إلى الفريق الذي يبني الطبقة المالية حيث يتحرك المال والكريبتو والعملات المحلية كنظام واحد."
        )}
        primary={{ label: copy("View open roles", "استعرض الوظائف"), href: "#open-positions" }}
        secondary={{ label: copy("How we work", "كيف نعمل"), href: "#culture" }}
      />

      <Band id="culture" maxW="1120px">
        <SectionHeading
          eyebrow={copy("Why tazdan", "لماذا tazdan")}
          title={
            <>
              {copy("A career for people who want to ", "مسار لمن يريدون ")}
              <Em>{copy("change finance", "تغيير التمويل")}</Em>.
            </>
          }
          lede={copy(
            "We are building for markets legacy finance ignored, with the care and restraint financial products deserve.",
            "نبني للأسواق التي تجاهلها التمويل التقليدي، بالعناية والانضباط الذي تستحقه المنتجات المالية."
          )}
        />
        <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
          {BENEFITS.map((benefit, index) => (
            <BentoCard
              key={benefit.title}
              icon={benefit.icon}
              title={copy(benefit.title, benefit.titleAr)}
              desc={copy(benefit.desc, benefit.descAr)}
              delay={index * 0.04}
            />
          ))}
        </SimpleGrid>
      </Band>

      <Band tone="alt" maxW="1120px">
        <SectionHeading
          eyebrow={copy("Operating principles", "مبادئ العمل")}
          title={
            <>
              {copy("Premium finance needs ", "التمويل الممتاز يحتاج إلى ")}
              <Em>{copy("adult judgment", "حكم ناضج")}</Em>.
            </>
          }
        />
        <SimpleGrid columns={{ base: 1, md: 3 }} gap={5}>
          {VALUES.map((value, index) => (
            <BentoCard
              key={value.title}
              icon={value.icon}
              title={copy(value.title, value.titleAr)}
              desc={copy(value.desc, value.descAr)}
              align="center"
              delay={index * 0.05}
            />
          ))}
        </SimpleGrid>
      </Band>

      <Band id="open-positions" maxW="1120px">
        <SectionHeading
          eyebrow={copy("Open roles", "الوظائف المتاحة")}
          title={
            <>
              {copy("Find your ", "اعثر على ")}
              <Em>{copy("seat", "مكانك")}</Em>.
            </>
          }
          lede={copy(
            "Lean team, high trust, real ownership. Every role below touches the product users will actually feel.",
            "فريق صغير، ثقة عالية، وملكية حقيقية. كل وظيفة هنا تمس منتجاً سيشعر به المستخدمون فعلاً."
          )}
        />
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={5}>
          {POSITIONS.map((position) => (
            <Box
              key={position.title}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="24px"
              p={{ base: 6, md: 7 }}
              transition="transform 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.35s"
              _hover={{ transform: "translateY(-4px)", bg: cardBgHover, borderColor: strongBorder }}
            >
              <VStack align="start" spacing={5}>
                <HStack justify="space-between" w="100%" align="start">
                  <Box>
                    <Text fontSize={{ base: "18px", md: "21px" }} fontWeight="800" letterSpacing="-0.02em" color={textMain}>
                      {copy(position.title, position.titleAr)}
                    </Text>
                    <HStack spacing={4} flexWrap="wrap" mt={3}>
                      <HStack spacing={1.5}>
                        <Icon as={FiBriefcase} boxSize={3.5} color={textSub} />
                        <Text fontSize="13px" color={textSub}>{copy(position.dept, position.deptAr)}</Text>
                      </HStack>
                      <HStack spacing={1.5}>
                        <Icon as={FiMapPin} boxSize={3.5} color={textSub} />
                        <Text fontSize="13px" color={textSub}>{copy(position.loc, position.locAr)}</Text>
                      </HStack>
                      <HStack spacing={1.5}>
                        <Icon as={FiClock} boxSize={3.5} color={textSub} />
                        <Text fontSize="13px" color={textSub}>{copy(position.exp, position.expAr)}</Text>
                      </HStack>
                    </HStack>
                  </Box>
                  <Text fontSize="12px" fontWeight="700" color={accentText} flexShrink={0}>
                    {copy("Open", "متاحة")}
                  </Text>
                </HStack>

                <Text fontSize="12.5px" fontWeight="700" color={textSub} lineHeight="1.7">
                  {position.skills.join("  /  ")}
                </Text>

                <Button
                  as="a"
                  href={`mailto:careers@tazdan.com?subject=Application - ${position.title}`}
                  h="44px"
                  px={6}
                  bg={accent}
                  color="#ffffff"
                  borderRadius="16px"
                  fontWeight="700"
                  fontSize="13px"
                  rightIcon={<Icon as={FiSend} boxSize={3.5} />}
                  _hover={{ transform: "scale(1.02)" }}
                  transition="all 0.25s cubic-bezier(0.16,1,0.3,1)"
                >
                  {copy("Apply now", "قدّم الآن")}
                </Button>
              </VStack>
            </Box>
          ))}
        </SimpleGrid>
      </Band>

      <CTASection
        title={copy("Do not see the exact role yet?", "لم تجد الوظيفة المناسبة؟")}
        subtitle={copy(
          "Send a general application. If the signal is strong, we will make room.",
          "أرسل طلباً عاماً. إذا كان الوضوح والقوة موجودين، سنجد المساحة المناسبة."
        )}
        primary={{ label: copy("Send general application", "أرسل طلباً عاماً"), href: "mailto:careers@tazdan.com?subject=General Application" }}
      />

      <PublicFooter />
    </Box>
  );
}
