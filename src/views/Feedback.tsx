"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, Check, Feather } from "lucide-react";
import Link from "next/link";
import { submitFeedback } from "@/app/feedback/actions";
import { useLanguage } from "@/contexts/LanguageContext";

type DeviceType = "mobile" | "desktop" | "tablet" | "other";
type TaskKey = "draft" | "publish" | "appreciation" | "follow" | "settings" | "export";
type TaskResult = "done" | "stuck" | "skipped";
type TaskAnswers = Record<TaskKey, TaskResult | "">;

const taskKeys: TaskKey[] = ["draft", "publish", "appreciation", "follow", "settings", "export"];
const initialTasks: TaskAnswers = { draft: "", publish: "", appreciation: "", follow: "", settings: "", export: "" };

export default function Feedback() {
  const { language } = useLanguage();
  const en = language === "en";
  const [device, setDevice] = useState<DeviceType | "">("");
  const [firstVisit, setFirstVisit] = useState<"yes" | "no" | "">("");
  const [tasks, setTasks] = useState<TaskAnswers>(initialTasks);
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(10).fill(null));
  const [confusion, setConfusion] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pending, setPending] = useState(false);
  const failed = en ? "We couldn't save your answers. Please try again." : "Jawaban belum tersimpan. Coba kirim sekali lagi.";

  const tasksCopy: Record<TaskKey, string> = en ? {
    draft: "Write a poem and save it as a draft.",
    publish: "Publish a poem and find it in Explore.",
    appreciation: "Find another poem and leave a heart or comment.",
    follow: "Follow a writer and find the notification.",
    settings: "Change something in your profile, language, or theme.",
    export: "Export a poem as a PDF or quote card.",
  } : {
    draft: "Tulis puisi lalu simpan sebagai draf.",
    publish: "Terbitkan puisi dan temukan di Jelajah.",
    appreciation: "Cari puisi lain, lalu beri hati atau komentar.",
    follow: "Ikuti seorang penulis dan temukan notifikasinya.",
    settings: "Ubah sesuatu di profil, bahasa, atau tampilan.",
    export: "Ekspor puisi sebagai PDF atau kartu kutipan.",
  };
  const statements = en ? [
    "I think that I would like to use Stanza frequently.",
    "I found Stanza unnecessarily complex.",
    "I thought Stanza was easy to use.",
    "I think that I would need the support of a technical person to use Stanza.",
    "I found the various functions in Stanza were well integrated.",
    "I thought there was too much inconsistency in Stanza.",
    "I would imagine that most people would learn to use Stanza very quickly.",
    "I found Stanza very cumbersome to use.",
    "I felt very confident using Stanza.",
    "I needed to learn a lot of things before I could get going with Stanza.",
  ] : [
    "Saya ingin menggunakan Stanza secara rutin.",
    "Saya merasa Stanza terlalu rumit.",
    "Saya merasa Stanza mudah digunakan.",
    "Saya perlu bantuan orang yang paham teknis untuk menggunakan Stanza.",
    "Fitur-fitur di Stanza terasa menyatu dengan baik.",
    "Saya merasa banyak hal di Stanza tidak konsisten.",
    "Saya membayangkan kebanyakan orang akan cepat belajar menggunakan Stanza.",
    "Saya merasa Stanza merepotkan untuk digunakan.",
    "Saya merasa percaya diri saat menggunakan Stanza.",
    "Saya perlu mempelajari banyak hal dulu sebelum bisa mulai menggunakan Stanza.",
  ];
  const statusLabels: Record<TaskResult, string> = en
    ? { done: "Completed", stuck: "Got stuck", skipped: "Didn't try" }
    : { done: "Selesai", stuck: "Tersendat", skipped: "Tidak dicoba" };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return; // guards against an accidental double submit
    setErrorMessage("");
    if (!device || !firstVisit || !consent || answers.some(answer => answer === null) || taskKeys.some(key => !tasks[key])) return;
    setPending(true);
    try {
      const response = await submitFeedback({
        deviceType: device,
        firstVisit: firstVisit === "yes",
        taskResults: tasks as Record<TaskKey, TaskResult>,
        susAnswers: answers as number[],
        confusion: confusion.trim(),
        suggestion: suggestion.trim(),
        consent: true,
      });
      if (response.ok) setSubmitted(true);
      else setErrorMessage(failed);
    } catch {
      setErrorMessage(failed);
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return <section className="feedback-page feedback-thanks">
      <div className="feedback-thanks-mark"><Check size={23} /></div>
      <p className="eyebrow">{en ? "THANK YOU" : "TERIMA KASIH"}</p>
      <h1>{en ? "Your feedback is in." : "Jawabanmu sudah masuk."}</h1>
      <p>{en ? "Your answers will help us decide what to improve next." : "Jawabanmu akan membantu menentukan apa yang perlu dibenahi berikutnya."}</p>
      <Link href="/explore" className="olive-button feedback-return">{en ? "Back to Explore" : "Kembali ke Jelajah"}</Link>
    </section>;
  }

  return <section className="feedback-page">
    <header className="feedback-intro">
      <p className="eyebrow"><Feather size={13} /> {en ? "STANZA USABILITY TEST" : "UJI COBA STANZA"}</p>
      <h1>{en ? <>How was your time on <em>Stanza?</em></> : <>Bagaimana pengalamanmu di <em>Stanza?</em></>}</h1>
      <p>{en ? "Try a few things in the app first, then answer based on what actually happened. Straightforward feedback helps most." : "Coba beberapa hal di aplikasi dulu, lalu jawab sesuai pengalamanmu. Jawaban jujur paling membantu."}</p>
      <span className="feedback-duration">{en ? "6 tasks · 10 questions · about 5 minutes" : "6 tugas · 10 pernyataan · sekitar 5 menit"}</span>
    </header>

    <form className="feedback-form" onSubmit={handleSubmit}>
      <section className="feedback-panel">
        <div className="feedback-section-heading"><span>01</span><div><h2>{en ? "A little context" : "Sedikit konteks"}</h2><p>{en ? "Just enough to understand the setting." : "Supaya kami paham kamu mencoba Stanza dari mana."}</p></div></div>
        <div className="feedback-context-grid">
          <label className="feedback-field">
            <span>{en ? "What are you using?" : "Kamu memakai perangkat apa?"}</span>
            <select required value={device} onChange={event => setDevice(event.target.value as DeviceType | "")}>
              <option value="">{en ? "Choose a device" : "Pilih perangkat"}</option>
              <option value="mobile">{en ? "Phone" : "Ponsel"}</option>
              <option value="desktop">{en ? "Desktop or laptop" : "Komputer atau laptop"}</option>
              <option value="tablet">Tablet</option>
              <option value="other">{en ? "Other" : "Lainnya"}</option>
            </select>
          </label>
          <label className="feedback-field">
            <span>{en ? "Is this your first time using Stanza?" : "Ini pertama kalinya kamu memakai Stanza?"}</span>
            <select required value={firstVisit} onChange={event => setFirstVisit(event.target.value as "yes" | "no" | "")}>
              <option value="">{en ? "Choose one" : "Pilih jawaban"}</option>
              <option value="yes">{en ? "Yes" : "Ya"}</option>
              <option value="no">{en ? "No" : "Tidak"}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="feedback-panel">
        <div className="feedback-section-heading"><span>02</span><div><h2>{en ? "How did the tasks go?" : "Bagaimana tugas-tugas ini berjalan?"}</h2><p>{en ? "Choose one answer for each. “Didn't try” is a perfectly fine answer." : "Pilih satu jawaban untuk setiap tugas. “Tidak dicoba” juga tidak apa-apa."}</p></div></div>
        <div className="feedback-task-list">
          {taskKeys.map((key, index) => <label className="feedback-task-row" key={key}>
            <span><b>{String(index + 1).padStart(2, "0")}</b>{tasksCopy[key]}</span>
            <select required value={tasks[key]} onChange={event => setTasks(current => ({ ...current, [key]: event.target.value as TaskResult | "" }))}>
              <option value="">{en ? "Choose result" : "Pilih hasil"}</option>
              <option value="done">{statusLabels.done}</option>
              <option value="stuck">{statusLabels.stuck}</option>
              <option value="skipped">{statusLabels.skipped}</option>
            </select>
          </label>)}
        </div>
      </section>

      <section className="feedback-panel">
        <div className="feedback-section-heading"><span>03</span><div><h2>{en ? "How much do you agree?" : "Seberapa setuju kamu?"}</h2><p>{en ? "Choose one number for each statement." : "Pilih satu angka untuk tiap pernyataan."}</p></div></div>
        <div className="feedback-scale-key"><span>{en ? "1 · Strongly disagree" : "1 · Sangat tidak setuju"}</span><span>{en ? "5 · Strongly agree" : "5 · Sangat setuju"}</span></div>
        <div className="feedback-sus-list">
          {statements.map((statement, index) => <fieldset className="feedback-sus-row" key={statement}>
            <legend><b>{String(index + 1).padStart(2, "0")}</b>{statement}</legend>
            <div className="feedback-options" role="radiogroup" aria-label={`${index + 1}. ${statement}`}>
              {[1, 2, 3, 4, 5].map(value => <label key={value} title={String(value)}>
                <input type="radio" name={`sus-${index}`} value={value} required checked={answers[index] === value} onChange={() => setAnswers(current => current.map((answer, item) => item === index ? value : answer))} />
                <span>{value}</span>
              </label>)}
            </div>
          </fieldset>)}
        </div>
      </section>

      <section className="feedback-panel">
        <div className="feedback-section-heading"><span>04</span><div><h2>{en ? "Anything else?" : "Ada hal lain?"}</h2><p>{en ? "Both answers are optional." : "Dua jawaban ini boleh dikosongkan."}</p></div></div>
        <label className="feedback-field feedback-textarea-field"><span>{en ? "Was anything confusing or hard to find?" : "Ada bagian yang membingungkan atau sulit ditemukan?"}</span><textarea value={confusion} maxLength={1500} onChange={event => setConfusion(event.target.value)} placeholder={en ? "A short note is enough." : "Ceritakan singkat saja."} /></label>
        <label className="feedback-field feedback-textarea-field"><span>{en ? "What should we improve first?" : "Apa yang sebaiknya kami benahi lebih dulu?"}</span><textarea value={suggestion} maxLength={1500} onChange={event => setSuggestion(event.target.value)} placeholder={en ? "For example, a missing step or a detail that got in your way." : "Misalnya, langkah yang kurang jelas atau hal yang menghambatmu."} /></label>
      </section>

      <div className="feedback-consent-wrap">
        <label className="feedback-consent"><input type="checkbox" required checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{en ? "I agree that my answers may be stored without linking them to my Stanza account, to help improve the product. I won't include names, email addresses, passwords, or other private details in my comments." : "Saya setuju jawaban ini disimpan tanpa dikaitkan ke akun Stanza untuk membantu memperbaiki produk. Saya tidak akan mencantumkan nama, email, kata sandi, atau informasi pribadi lain di komentar."}</span></label>
        {errorMessage && <p className="feedback-error" role="alert">{errorMessage}</p>}
        <button className="olive-button feedback-submit" type="submit" disabled={pending}>{pending ? (en ? "Sending…" : "Mengirim…") : (en ? "Send my answers" : "Kirim jawaban")}</button>
        <Link href="/explore" className="feedback-back"><ArrowLeft size={14} /> {en ? "Back to Stanza" : "Kembali ke Stanza"}</Link>
      </div>
    </form>
  </section>;
}
