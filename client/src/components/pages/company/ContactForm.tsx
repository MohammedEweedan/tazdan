"use client";

/* The contact form. Posts exactly what the previous form posted —
   JSON { name, email, topic, msg } to /api/contact
   (client/src/app/api/contact/route.ts) — and resets on success. */

import { useId, useState } from "react";
import { Box, Input, Select, Textarea, useToast } from "@chakra-ui/react";
import { useTranslate } from "@tolgee/react";
import { FiSend } from "react-icons/fi";
import { Footnote, SiteButton, useSiteTheme } from "@/components/site";
import { FieldLabel, useFieldStyle } from "./fields";

export const CONTACT_TOPICS = [
  { value: "support", label: "company.contact.form.topic.support" },
  { value: "kyc", label: "company.contact.form.topic.kyc" },
  { value: "security", label: "company.contact.form.topic.security" },
  { value: "business", label: "company.contact.form.topic.business" },
  { value: "partners", label: "company.contact.form.topic.partners" },
  { value: "press", label: "company.contact.form.topic.press" },
] as const;

type Status = { kind: "idle" | "ok" | "error" | "invalid" };

export default function ContactForm({ topic, onTopic }: { topic: string; onTopic: (v: string) => void }) {
  const { t } = useTranslate();
  const theme = useSiteTheme();
  const field = useFieldStyle();
  const toast = useToast();
  const uid = useId();
  const [form, setForm] = useState({ name: "", email: "", msg: "" });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const payload = { name: form.name.trim(), email: form.email.trim(), topic, msg: form.msg.trim() };
    if (!payload.name || !payload.email.includes("@") || !payload.msg) { setStatus({ kind: "invalid" }); return; }
    setSubmitting(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, topic, msg: form.msg }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus({ kind: "ok" });
      toast({ title: t("company.contact.form.success.title"), description: t("company.contact.form.success.body"), status: "success", duration: 5000 });
      setForm({ name: "", email: "", msg: "" });
      onTopic("support");
    } catch {
      setStatus({ kind: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const msgs = {
    ok: { color: theme.green, text: `${t("company.contact.form.success.title")} — ${t("company.contact.form.success.body")}` },
    error: { color: theme.red, text: t("company.contact.form.error") },
    invalid: { color: theme.red, text: t("company.contact.form.invalid") },
  } as const;

  return (
    <Box as="form" onSubmit={submit} noValidate display="grid" gap="20px">
      <Box display="grid" gridTemplateColumns={{ base: "minmax(0,1fr)", sm: "repeat(2, minmax(0,1fr))" }} gap="20px">
        <Box>
          <FieldLabel htmlFor={`${uid}-name`}>{t("company.contact.form.name")}</FieldLabel>
          <Input id={`${uid}-name`} name="name" autoComplete="name" required h="52px" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} {...field} />
        </Box>
        <Box>
          <FieldLabel htmlFor={`${uid}-email`}>{t("company.contact.form.email")}</FieldLabel>
          <Input id={`${uid}-email`} name="email" type="email" autoComplete="email" required h="52px" dir="ltr" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} {...field} />
        </Box>
      </Box>
      <Box>
        <FieldLabel htmlFor="contact-topic">{t("company.contact.form.topic")}</FieldLabel>
        <Select id="contact-topic" name="topic" h="52px" value={topic} onChange={(e) => onTopic(e.target.value)} {...field}
            /* Chakra keeps the chevron on the physical right but flips its padding in RTL — pin both sides. */
            style={{ paddingLeft: 16, paddingRight: 40 }}>
          {CONTACT_TOPICS.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
        </Select>
      </Box>
      <Box>
        <FieldLabel htmlFor={`${uid}-msg`}>{t("company.contact.form.msg")}</FieldLabel>
        <Textarea id={`${uid}-msg`} name="msg" required minH="160px" py="14px" value={form.msg}
          aria-describedby={`${uid}-hint`} onChange={(e) => setForm({ ...form, msg: e.target.value })} {...field} />
        <Footnote id={`${uid}-hint`} mt="8px">{t("company.contact.form.msgHint")}</Footnote>
      </Box>
      <Box display="flex" flexWrap="wrap" alignItems="center" gap="16px">
        <SiteButton type="submit" size="lg" disabled={submitting} opacity={submitting ? 0.7 : 1}>
          <FiSend aria-hidden />{submitting ? t("company.contact.form.sending") : t("company.contact.form.send")}
        </SiteButton>
        <Box role="status" aria-live="polite" fontSize="14.5px" color={status.kind === "idle" ? theme.fgMuted : msgs[status.kind].color} flex="1" minW="200px">
          {status.kind !== "idle" && msgs[status.kind].text}
        </Box>
      </Box>
    </Box>
  );
}
