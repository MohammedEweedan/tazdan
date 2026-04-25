"use client";

import {
  IconButton,
  useColorMode,
  useColorModeValue,
  Box,
  VStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Text,
} from "@chakra-ui/react";
import { useTolgee } from "@tolgee/react";
import { FiGlobe } from "react-icons/fi";
import { useState } from "react";

export default function LanguageThemeSwitcher() {
  const tolgee = useTolgee(["language"]);
  const currentLang = tolgee.getLanguage();
  const { colorMode, toggleColorMode } = useColorMode();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const switchLanguage = (lang: string) => {
    tolgee.changeLanguage(lang);
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    setIsModalOpen(false);
  };

  const iconColor = useColorModeValue("gray.600", "gray.300");
  const hoverBg = useColorModeValue("gray.100", "whiteAlpha.200");
  const activeBg = useColorModeValue("blue.50", "blue.900");
  const activeText = useColorModeValue("blue.600", "blue.300");

  const languages = [
    { code: "en", name: "English" },
    { code: "ar", name: "العربية" },
    { code: "fr", name: "Français" },
    { code: "es", name: "Español" },
    { code: "de", name: "Deutsch" },
    { code: "nl", name: "Nederlands" },
    { code: "ru", name: "Русский" },
    { code: "cn", name: "中文" },
  ];

  return (
    <>
      <IconButton
        icon={<FiGlobe />}
        aria-label="Change language"
        onClick={() => setIsModalOpen(true)}
        variant="ghost"
        color={iconColor}
        _hover={{ bg: hoverBg }}
        transition="all 0.2s"
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader textAlign="center"></ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <VStack spacing={2}>
              {languages.map((lang) => (
                <Box
                  key={lang.code}
                  as="button"
                  w="full"
                  p={3}
                  borderRadius="md"
                  bg={currentLang === lang.code ? activeBg : "transparent"}
                  color={currentLang === lang.code ? activeText : "inherit"}
                  fontWeight={currentLang === lang.code ? "600" : "400"}
                  onClick={() => switchLanguage(lang.code)}
                  _hover={{ bg: currentLang === lang.code ? activeBg : hoverBg }}
                  transition="all 0.2s"
                  textAlign="left"
                >
                  <Text>{lang.name}</Text>
                </Box>
              ))}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
