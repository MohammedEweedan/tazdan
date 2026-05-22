'use client';

import NextLink from 'next/link';
import {
  Box, Container, VStack, HStack, Heading, Text, Button, SimpleGrid,
  Icon, Flex, Badge,
} from '@chakra-ui/react';
import {
  FiMapPin, FiBriefcase, FiClock, FiDollarSign, FiTrendingUp, FiUsers,
  FiAward, FiTarget, FiSend, FiArrowRight, FiShield, FiZap, FiGlobe,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useColorMode } from '@chakra-ui/react';
import PublicNav from '@/components/ui/PublicNav';
import PublicFooter from '@/components/ui/PublicFooter';
import WaitlistSection from '@/components/ui/WaitlistSection';

const MotionBox = motion(Box as any);

const BENEFITS = [
  { icon: FiDollarSign, title: 'Competitive Salary',     desc: 'Market-leading compensation with performance bonuses.' },
  { icon: FiAward,      title: 'Equity',                 desc: 'Real ownership in a fast-growing fintech company.' },
  { icon: FiClock,      title: 'Flexible Hours',         desc: 'Async-first culture. Work when you do your best thinking.' },
  { icon: FiTarget,     title: 'Growth Path',            desc: 'Clear career ladders and budget for continuous learning.' },
  { icon: FiUsers,      title: 'World-class Team',       desc: 'Work alongside engineers and operators from top companies.' },
  { icon: FiGlobe,      title: 'Remote-friendly',        desc: 'Most roles are fully remote with optional Tripoli hub access.' },
];

const VALUES = [
  { icon: FiShield,      title: 'Security First',   desc: 'Every product decision starts with "is this safe for the user?"' },
  { icon: FiZap,         title: 'Move Fast',         desc: 'We ship weekly, learn in days, and avoid death-by-committee.' },
  { icon: FiTrendingUp,  title: 'Own the Outcome',  desc: 'We hire adults. You own your work end-to-end.' },
];

const POSITIONS = [
  { title: 'Senior Frontend Engineer',      dept: 'Engineering', loc: 'Remote / Tripoli', type: 'Full-time', exp: '5+ yrs', skills: ['React', 'TypeScript', 'Next.js', 'Chakra UI'] },
  { title: 'Backend Engineer',              dept: 'Engineering', loc: 'Tripoli',           type: 'Full-time', exp: '3+ yrs', skills: ['Node.js', 'PostgreSQL', 'API Design', 'Security'] },
  { title: 'Product Manager',               dept: 'Product',     loc: 'Remote',            type: 'Full-time', exp: '3+ yrs', skills: ['Fintech', 'Agile', 'Data Analysis', 'User Research'] },
  { title: 'Compliance & AML Officer',      dept: 'Compliance',  loc: 'Tripoli',           type: 'Full-time', exp: '2+ yrs', skills: ['AML/KYC', 'Regulations', 'Risk Management', 'Auditing'] },
  { title: 'Customer Support Specialist',   dept: 'Support',     loc: 'Remote',            type: 'Full-time', exp: '1+ yrs', skills: ['Customer Service', 'Crypto', 'Multilingual'] },
  { title: 'Growth & Marketing Manager',    dept: 'Marketing',   loc: 'Remote',            type: 'Full-time', exp: '4+ yrs', skills: ['Digital Marketing', 'Analytics', 'Growth', 'Content'] },
];

export default function CareersPage() {
  const { colorMode } = useColorMode();
  const dark = colorMode === 'dark';

  const pageBg    = dark ? '#000000' : '#ffffff';
  const textMain  = dark ? '#ffffff' : '#0a0f1e';
  const textSub   = dark ? 'rgba(255,255,255,0.6)' : '#64748b';
  const cardBg    = dark ? 'rgba(255,255,255,0.04)' : '#f4f4f4';
  const cardBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const ctaBg     = dark ? '#ffffff' : '#0a0f1e';
  const ctaFg     = dark ? '#000000' : '#ffffff';

  const titleGradient = dark
    ? 'linear(to-b, #ffffff 0%, rgba(255,255,255,0.85) 60%, rgba(255,255,255,0.3) 100%)'
    : 'linear(to-b, #000000 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.2) 100%)';

  return (
    <Box minH="100vh" bg={pageBg} color={textMain} overflowX="clip">
      <PublicNav />

      {/* ── Hero ── */}
      <Box pt={{ base: '120px', md: '170px' }} pb={{ base: 14, md: 20 }} textAlign="center">
        <Container maxW="860px">
          <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
            <VStack spacing={6}>
              <Box
                display="inline-block" px={3} py={1} borderRadius="full"
                bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                border="1px solid" borderColor={cardBorder}
                fontSize="11px" fontWeight="800" letterSpacing="0.14em" textTransform="uppercase" color={textMain}
              >
                We&apos;re Hiring
              </Box>
              <Heading
                as="h1" fontWeight="900"
                fontSize={{ base: '52px', md: '88px' }}
                lineHeight="0.95" letterSpacing="-0.045em"
                bgGradient={titleGradient} bgClip="text"
              >
                Build the future{'\n'}of money
              </Heading>
              <Text fontSize={{ base: '15px', md: '19px' }} color={textSub} maxW="520px" lineHeight="1.7">
                Join the team making crypto and cross-border finance simple for millions of people across the MENA region and beyond.
              </Text>
              <HStack spacing={3} pt={2} flexWrap="wrap" justify="center">
                <Button
                  as="a" href="#open-positions"
                  h="52px" px={8} bg={ctaBg} color={ctaFg}
                  borderRadius="full" fontWeight="800" fontSize="14px"
                  rightIcon={<Icon as={FiArrowRight} />}
                  _hover={{ opacity: 0.88, transform: 'translateY(-1px)' }}
                  transition="all 0.15s"
                >
                  View Open Positions
                </Button>
                <Button
                  as="a" href="#culture"
                  h="52px" px={8}
                  bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}
                  color={textMain}
                  border="1px solid" borderColor={cardBorder}
                  borderRadius="full" fontWeight="700" fontSize="14px"
                  _hover={{ bg: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}
                  transition="all 0.15s"
                >
                  Our Culture
                </Button>
              </HStack>
            </VStack>
          </motion.div>
        </Container>
      </Box>

      {/* ── Why Join ── */}
      <Box py={{ base: 16, md: 24 }} id="culture">
        <Container maxW="1100px">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6 }}>
            <VStack spacing={3} mb={{ base: 10, md: 14 }} textAlign="center">
              <Text fontSize="11px" fontWeight="800" letterSpacing="0.14em" textTransform="uppercase" color={textSub}>WHY FORTUNI</Text>
              <Heading fontSize={{ base: '32px', md: '52px' }} fontWeight="900" letterSpacing="-0.04em" color={textMain} lineHeight="1">
                A career worth building
              </Heading>
            </VStack>
          </motion.div>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
            {BENEFITS.map((b, i) => (
              <motion.div key={b.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.07 }}>
                <Box
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="20px" p={6} h="100%"
                  transition="all 0.2s ease"
                  _hover={{ transform: 'translateY(-3px)', borderColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}
                >
                  <Flex w="40px" h="40px" borderRadius="12px"
                    bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                    border="1px solid" borderColor={cardBorder}
                    align="center" justify="center" mb={4}
                  >
                    <Icon as={b.icon} color={textMain} boxSize={4} />
                  </Flex>
                  <Text fontSize="16px" fontWeight="800" color={textMain} mb={2} letterSpacing="-0.01em">{b.title}</Text>
                  <Text fontSize="13.5px" color={textSub} lineHeight="1.6">{b.desc}</Text>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ── Values ── */}
      <Box py={{ base: 16, md: 24 }} bg={dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}>
        <Container maxW="1100px">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6 }}>
            <VStack spacing={3} mb={{ base: 10, md: 14 }} textAlign="center">
              <Text fontSize="11px" fontWeight="800" letterSpacing="0.14em" textTransform="uppercase" color={textSub}>OUR VALUES</Text>
              <Heading fontSize={{ base: '32px', md: '52px' }} fontWeight="900" letterSpacing="-0.04em" color={textMain} lineHeight="1">
                What we stand for
              </Heading>
            </VStack>
          </motion.div>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
            {VALUES.map((v, i) => (
              <motion.div key={v.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.08 }}>
                <VStack
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="20px" p={8} spacing={4} align="center" textAlign="center" h="100%"
                  transition="all 0.2s ease"
                  _hover={{ transform: 'translateY(-3px)', borderColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}
                >
                  <Flex w="56px" h="56px" borderRadius="16px"
                    bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                    border="1px solid" borderColor={cardBorder}
                    align="center" justify="center"
                  >
                    <Icon as={v.icon} color={textMain} boxSize={6} />
                  </Flex>
                  <Text fontSize="18px" fontWeight="800" color={textMain} letterSpacing="-0.015em">{v.title}</Text>
                  <Text fontSize="14px" color={textSub} lineHeight="1.7">{v.desc}</Text>
                </VStack>
              </motion.div>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ── Open Positions ── */}
      <Box py={{ base: 16, md: 24 }} id="open-positions">
        <Container maxW="1100px">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.6 }}>
            <VStack spacing={3} mb={{ base: 10, md: 14 }} textAlign="center">
              <Text fontSize="11px" fontWeight="800" letterSpacing="0.14em" textTransform="uppercase" color={textSub}>OPEN ROLES</Text>
              <Heading fontSize={{ base: '32px', md: '52px' }} fontWeight="900" letterSpacing="-0.04em" color={textMain} lineHeight="1">
                Find your role
              </Heading>
              <Text fontSize={{ base: '15px', md: '17px' }} color={textSub} maxW="400px">
                All roles offer meaningful equity and real impact.
              </Text>
            </VStack>
          </motion.div>

          <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4}>
            {POSITIONS.map((pos, i) => (
              <motion.div key={pos.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.5, delay: i * 0.06 }}>
                <Box
                  bg={cardBg} border="1px solid" borderColor={cardBorder}
                  borderRadius="20px" p={6} h="100%"
                  transition="all 0.2s ease"
                  _hover={{ transform: 'translateY(-3px)', borderColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}
                >
                  <VStack align="start" spacing={4}>
                    <HStack justify="space-between" w="100%">
                      <Text fontSize="17px" fontWeight="800" color={textMain} letterSpacing="-0.01em">{pos.title}</Text>
                      <Badge
                        bg={dark ? 'rgba(74,222,128,0.15)' : 'rgba(22,163,74,0.10)'}
                        color={dark ? '#4ade80' : '#16a34a'}
                        fontSize="9.5px" px={2.5} py={1} borderRadius="full" letterSpacing="0.08em" fontWeight="800"
                      >
                        OPEN
                      </Badge>
                    </HStack>
                    <HStack spacing={4} flexWrap="wrap">
                      <HStack spacing={1.5}>
                        <Icon as={FiBriefcase} boxSize={3.5} color={textSub} />
                        <Text fontSize="13px" color={textSub}>{pos.dept}</Text>
                      </HStack>
                      <HStack spacing={1.5}>
                        <Icon as={FiMapPin} boxSize={3.5} color={textSub} />
                        <Text fontSize="13px" color={textSub}>{pos.loc}</Text>
                      </HStack>
                      <HStack spacing={1.5}>
                        <Icon as={FiClock} boxSize={3.5} color={textSub} />
                        <Text fontSize="13px" color={textSub}>{pos.exp}</Text>
                      </HStack>
                    </HStack>
                    <HStack spacing={2} flexWrap="wrap">
                      {pos.skills.map((skill) => (
                        <Box key={skill}
                          px={2.5} py={1} borderRadius="8px"
                          bg={dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}
                          border="1px solid" borderColor={cardBorder}
                        >
                          <Text fontSize="11px" fontWeight="700" color={textSub} letterSpacing="0.04em">{skill}</Text>
                        </Box>
                      ))}
                    </HStack>
                    <Button
                      as="a"
                      href={`mailto:careers@promrkts.com?subject=Application — ${pos.title}`}
                      h="40px" px={5} w="100%"
                      bg={ctaBg} color={ctaFg}
                      borderRadius="full" fontWeight="700" fontSize="13px"
                      rightIcon={<Icon as={FiSend} boxSize={3.5} />}
                      _hover={{ opacity: 0.88 }}
                      transition="all 0.15s"
                    >
                      Apply Now
                    </Button>
                  </VStack>
                </Box>
              </motion.div>
            ))}
          </SimpleGrid>

          {/* General application */}
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <VStack
              mt={8} py={10} px={8} spacing={4} textAlign="center"
              bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="24px"
            >
              <Text fontSize="20px" fontWeight="800" color={textMain} letterSpacing="-0.02em">
                Don&apos;t see your role?
              </Text>
              <Text fontSize="15px" color={textSub} maxW="400px" lineHeight="1.7">
                We&apos;re always looking for exceptional talent. Send your CV and we&apos;ll reach out when the right role opens.
              </Text>
              <Button
                as="a"
                href="mailto:careers@promrkts.com?subject=General Application"
                h="46px" px={7}
                bg={dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                color={textMain}
                border="1px solid" borderColor={cardBorder}
                borderRadius="full" fontWeight="700" fontSize="14px"
                rightIcon={<Icon as={FiArrowRight} />}
                _hover={{ bg: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)' }}
                transition="all 0.15s"
              >
                Send General Application
              </Button>
            </VStack>
          </motion.div>
        </Container>
      </Box>

      <WaitlistSection />
      <PublicFooter />
    </Box>
  );
}
