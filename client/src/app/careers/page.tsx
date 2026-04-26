'use client';

import NextLink from 'next/link';
import {
  Box, Container, VStack, HStack, Heading, Text, Button, SimpleGrid, Icon,
  useColorModeValue, Divider, Badge, Flex, List, ListItem, ListIcon,
} from '@chakra-ui/react';
import { useTranslate } from '@tolgee/react';
import {
  FiMapPin, FiBriefcase, FiClock, FiDollarSign, FiTrendingUp, FiUsers,
  FiAward, FiTarget, FiSend, FiArrowRight, FiCheckCircle, FiStar, FiShield,
} from 'react-icons/fi';
import Logo from '@/components/ui/Logo';

export default function CareersPage() {
  const { t } = useTranslate();

  // All useColorModeValue calls at top level
  const cardBg = useColorModeValue('white', 'gray.800');
  const cardBorder = useColorModeValue('gray.200', 'gray.700');
  const subtleText = useColorModeValue('gray.600', 'gray.400');
  const accentBg = useColorModeValue('brand.50', 'whiteAlpha.100');

  const benefits = [
    { icon: FiDollarSign, title: 'Competitive Salary', desc: 'Market-leading compensation packages' },
    { icon: FiAward, title: 'Stock Options', desc: 'Equity in our growing company' },
    { icon: FiClock, title: 'Flexible Hours', desc: 'Work-life balance with flexible schedules' },
    { icon: FiTarget, title: 'Growth Opportunities', desc: 'Clear career advancement paths' },
    { icon: FiUsers, title: 'Great Team', desc: 'Work with talented professionals' },
    { icon: FiStar, title: 'Health Benefits', desc: 'Comprehensive health and wellness coverage' },
  ];

  const openPositions = [
    {
      title: 'Senior Frontend Developer',
      department: 'Engineering',
      location: 'Remote / Tripoli',
      type: 'Full-time',
      experience: '5+ years',
      skills: ['React', 'TypeScript', 'Next.js', 'Chakra UI'],
    },
    {
      title: 'Backend Engineer',
      department: 'Engineering',
      location: 'Tripoli',
      type: 'Full-time',
      experience: '3+ years',
      skills: ['Node.js', 'PostgreSQL', 'API Design', 'Security'],
    },
    {
      title: 'Product Manager',
      department: 'Product',
      location: 'Remote',
      type: 'Full-time',
      experience: '3+ years',
      skills: ['Fintech', 'Agile', 'Data Analysis', 'User Research'],
    },
    {
      title: 'Compliance Officer',
      department: 'Compliance',
      location: 'Tripoli',
      type: 'Full-time',
      experience: '2+ years',
      skills: ['AML/KYC', 'Regulations', 'Risk Management', 'Auditing'],
    },
    {
      title: 'Customer Support Specialist',
      department: 'Support',
      location: 'Remote',
      type: 'Full-time',
      experience: '1+ years',
      skills: ['Customer Service', 'Cryptocurrency', 'Multilingual', 'Problem Solving'],
    },
    {
      title: 'Marketing Manager',
      department: 'Marketing',
      location: 'Remote',
      type: 'Full-time',
      experience: '4+ years',
      skills: ['Digital Marketing', 'Content Strategy', 'Analytics', 'Growth Hacking'],
    },
  ];

  return (
    <Box minH="100vh">
      {/* Hero Section */}
      <Box py={{ base: 20, md: 28 }} bgGradient="linear(to-b, brand.50, transparent 50%)">
        <Container maxW="7xl">
          <VStack spacing={8} textAlign="center" maxW="3xl" mx="auto">
            <HStack as={NextLink} href="/" spacing={2} _hover={{ opacity: 0.85 }} transition="opacity 0.2s">
              <Logo h={40} />
            </HStack>
            <Badge colorScheme="brand" px={4} py={2} rounded="full" fontSize="sm" textTransform="uppercase" letterSpacing="wider">
              Join Our Team
            </Badge>
            <Heading size={{ base: '3xl', md: '4xl' }} fontWeight="extrabold" lineHeight="1.2">
              Build the Future of
              <br />
              <Text as="span" bgGradient="linear(to-r, #0057b8, #1f9bff)" bgClip="text">
                Global Crypto Trading
              </Text>
            </Heading>
            <Text fontSize={{ base: 'lg', md: 'xl' }} color={subtleText} lineHeight="tall">
              Join promrkts and help revolutionize cryptocurrency trading globally. We're looking for talented individuals who are passionate about fintech and want to make a real impact.
            </Text>
            <HStack spacing={4}>
              <Button
                as="a"
                href="#open-positions"
                bg="#0057b8"
                color="white"
                size="lg"
                rightIcon={<FiArrowRight />}
                _hover={{ bg: '#004ea7', transform: 'translateY(-2px)' }}
                transition="all 0.2s"
              >
                View Open Positions
              </Button>
              <Button
                as="a"
                href="#culture"
                variant="outline"
                borderColor="brand.500"
                color="brand.500"
                size="lg"
                _hover={{ bg: 'brand.50', _dark: { bg: 'whiteAlpha.100' } }}
              >
                Our Culture
              </Button>
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* Why Join Us */}
      <Box py={20} id="culture">
        <Container maxW="7xl">
          <VStack spacing={12}>
            <VStack spacing={4} textAlign="center">
              <Heading size="2xl" fontWeight="bold">Why Join promrkts?</Heading>
              <Text fontSize="lg" color={subtleText} maxW="2xl">
                We're building a leading global cryptocurrency exchange with a mission to make digital assets accessible to everyone.
              </Text>
            </VStack>

            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={8}>
              {benefits.map((benefit, i) => (
                <Box
                  key={i}
                  p={6}
                  bg={cardBg}
                  borderWidth="1px"
                  borderColor={cardBorder}
                  rounded="2xl"
                  transition="all 0.3s"
                  _hover={{ shadow: 'lg', borderColor: 'brand.500', transform: 'translateY(-4px)' }}
                >
                  <Flex align="center" justify="center" w={12} h={12} rounded="xl" bg={accentBg} mb={4}>
                    <Icon as={benefit.icon} boxSize={6} color="brand.500" />
                  </Flex>
                  <Heading size="md" mb={2}>{benefit.title}</Heading>
                  <Text fontSize="sm" color={subtleText} lineHeight="tall">{benefit.desc}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* Open Positions */}
      <Box py={20} bg={cardBg} id="open-positions">
        <Container maxW="7xl">
          <VStack spacing={12}>
            <VStack spacing={4} textAlign="center">
              <Heading size="2xl" fontWeight="bold">Open Positions</Heading>
              <Text fontSize="lg" color={subtleText}>
                Find your next opportunity with us
              </Text>
            </VStack>

            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
              {openPositions.map((position, i) => (
                <Box
                  key={i}
                  p={6}
                  borderWidth="1px"
                  borderColor={cardBorder}
                  rounded="2xl"
                  transition="all 0.3s"
                  _hover={{ shadow: 'lg', borderColor: 'brand.500' }}
                >
                  <VStack align="start" spacing={4}>
                    <HStack justify="space-between" w="full">
                      <Heading size="md" fontWeight="bold">{position.title}</Heading>
                      <Badge colorScheme="green" variant="subtle">Open</Badge>
                    </HStack>

                    <HStack spacing={4} flexWrap="wrap">
                      <HStack spacing={1}>
                        <Icon as={FiBriefcase} boxSize={4} color={subtleText} />
                        <Text fontSize="sm" color={subtleText}>{position.department}</Text>
                      </HStack>
                      <HStack spacing={1}>
                        <Icon as={FiMapPin} boxSize={4} color={subtleText} />
                        <Text fontSize="sm" color={subtleText}>{position.location}</Text>
                      </HStack>
                      <HStack spacing={1}>
                        <Icon as={FiClock} boxSize={4} color={subtleText} />
                        <Text fontSize="sm" color={subtleText}>{position.type}</Text>
                      </HStack>
                    </HStack>

                    <VStack align="start" spacing={2}>
                      <Text fontSize="sm" fontWeight="medium">Experience Required:</Text>
                      <Text fontSize="sm" color={subtleText}>{position.experience}</Text>
                    </VStack>

                    <VStack align="start" spacing={2}>
                      <Text fontSize="sm" fontWeight="medium">Key Skills:</Text>
                      <HStack spacing={2} flexWrap="wrap">
                        {position.skills.map((skill, j) => (
                          <Badge key={j} variant="outline" fontSize="xs" colorScheme="brand">
                            {skill}
                          </Badge>
                        ))}
                      </HStack>
                    </VStack>

                    <Button
                      as="a"
                      href={`mailto:careers@promrkts.com?subject=Application for ${position.title}`}
                      bg="#0057b8"
                      color="white"
                      size="sm"
                      rightIcon={<FiSend />}
                      _hover={{ bg: '#004ea7' }}
                      w="full"
                    >
                      Apply Now
                    </Button>
                  </VStack>
                </Box>
              ))}
            </SimpleGrid>

            <VStack spacing={4} textAlign="center" py={8}>
              <Heading size="lg" fontWeight="bold">Don't see what you're looking for?</Heading>
              <Text color={subtleText} maxW="md">
                We're always looking for talented people to join our team. Send us your resume and we'll keep you in mind for future opportunities.
              </Text>
              <Button
                as="a"
                href="mailto:careers@promrkts.com?subject=General Application"
                variant="outline"
                borderColor="brand.500"
                color="brand.500"
                _hover={{ bg: 'brand.50', _dark: { bg: 'whiteAlpha.100' } }}
              >
                Send General Application
              </Button>
            </VStack>
          </VStack>
        </Container>
      </Box>

      {/* Our Values */}
      <Box py={20}>
        <Container maxW="7xl">
          <VStack spacing={12}>
            <VStack spacing={4} textAlign="center">
              <Heading size="2xl" fontWeight="bold">Our Values</Heading>
              <Text fontSize="lg" color={subtleText} maxW="2xl">
                The principles that guide everything we do
              </Text>
            </VStack>

            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8}>
              <VStack spacing={4} align="center">
                <Flex align="center" justify="center" w={16} h={16} rounded="2xl" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }}>
                  <Icon as={FiShield} boxSize={8} color="brand.500" />
                </Flex>
                <Heading size="md" textAlign="center">Security First</Heading>
                <Text fontSize="sm" color={subtleText} textAlign="center" lineHeight="tall">
                  We prioritize the security of our users' assets above everything else
                </Text>
              </VStack>

              <VStack spacing={4} align="center">
                <Flex align="center" justify="center" w={16} h={16} rounded="2xl" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }}>
                  <Icon as={FiTrendingUp} boxSize={8} color="brand.500" />
                </Flex>
                <Heading size="md" textAlign="center">Innovation</Heading>
                <Text fontSize="sm" color={subtleText} textAlign="center" lineHeight="tall">
                  We constantly push boundaries to create better financial solutions
                </Text>
              </VStack>

              <VStack spacing={4} align="center">
                <Flex align="center" justify="center" w={16} h={16} rounded="2xl" bg="brand.50" _dark={{ bg: 'whiteAlpha.100' }}>
                  <Icon as={FiUsers} boxSize={8} color="brand.500" />
                </Flex>
                <Heading size="md" textAlign="center">Customer Focus</Heading>
                <Text fontSize="sm" color={subtleText} textAlign="center" lineHeight="tall">
                  Our users are at the heart of every decision we make
                </Text>
              </VStack>
            </SimpleGrid>
          </VStack>
        </Container>
      </Box>

      {/* Footer */}
      <Box py={12} borderTopWidth="1px" borderColor={cardBorder}>
        <Container maxW="7xl">
          <Flex align="center" justify="space-between" direction={{ base: 'column', md: 'row' }} gap={4}>
            <HStack spacing={2}>
              <Logo h={32} />
            </HStack>
            <Text fontSize="sm" color={subtleText}>
              Questions about careers? Contact us at{' '}
              <Text as="span" color="brand.500" fontWeight="medium">careers@promrkts.com</Text>
            </Text>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
}
