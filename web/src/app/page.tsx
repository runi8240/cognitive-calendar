"use client";

import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventClickArg } from "@fullcalendar/core";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import clsx from "clsx";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5050";

type Classification = {
  meeting_type: string;
  role: string;
  emotional_intensity: string;
  topic_tags: string[];
};

type EventLoad = {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  attendeeCount: number;
  userRole: string;
  classification: Classification;
  durationMinutes: number;
  mentalLoad: number;
  contextSwitchCost: number;
  totalLoad: number;
  recoveryMinutes: number;
  timeOfDay: string;
  socialLoad: number;
  capacityCost: number;
  capacityRemaining: number;
  explanation: {
    complexity: number;
    roleLoad: number;
    emotionalLoad: number;
    socialLoad: number;
    mentalLoad: number;
    contextSwitchCost: number;
    timeOfDayMultiplier: number;
    topicTags: string[];
  };
};

type Summary = {
  totalLoad: number;
  capacityRemaining: number;
  highRisk: boolean;
};

export default function Home() {
  const [events, setEvents] = useState<EventLoad[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventLoad | null>(null);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [voiceResponse, setVoiceResponse] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "loading">("idle");

  useEffect(() => {
    const fetchEvents = async () => {
      const response = await fetch(`${API_BASE}/api/events`);
      const data = await response.json();
      setEvents(data.events || []);
      setSummary(data.summary || null);
      if (data.events?.length) {
        setSelectedEvent(data.events[0]);
      }
    };

    fetchEvents();
  }, []);

  const calendarEvents = useMemo(() => {
    const primary = events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      backgroundColor: loadToColor(event.mentalLoad),
      borderColor: loadToColor(event.mentalLoad),
      textColor: "#111827",
      extendedProps: event,
    }));

    const recovery = events.map((event) => {
      const start = new Date(event.end);
      const end = new Date(start.getTime() + event.recoveryMinutes * 60000);
      return {
        id: `${event.id}-recovery`,
        title: "Recovery",
        start: start.toISOString(),
        end: end.toISOString(),
        display: "background" as const,
        backgroundColor: "rgba(250, 204, 21, 0.25)",
      };
    });

    return [...primary, ...recovery];
  }, [events]);

  const contextSwitches = useMemo(() => {
    return events.slice(1).map((event, index) => ({
      from: events[index],
      to: event,
    }));
  }, [events]);

  const handleEventClick = (info: EventClickArg) => {
    const extended = info.event.extendedProps as EventLoad | undefined;
    if (extended?.id) {
      setSelectedEvent(extended);
    }
  };

  const runVoiceQuery = async (queryOverride?: string) => {
    const query = queryOverride || voiceQuery;
    if (!query) return;

    setVoiceStatus("loading");
    const response = await fetch(`${API_BASE}/api/voice/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, summary }),
    });
    const data = await response.json();
    setVoiceResponse(data.text || "");

    if (data.audio?.status === "ok") {
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio.audioBase64}`);
      audio.play();
    }

    setVoiceStatus("idle");
  };

  const handleVoiceCapture = () => {
    const SpeechRecognition =
      (window as typeof window & {
        webkitSpeechRecognition?: typeof window.SpeechRecognition;
      }).SpeechRecognition ||
      (window as typeof window & {
        webkitSpeechRecognition?: typeof window.SpeechRecognition;
      }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceResponse("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setVoiceQuery(transcript);
      runVoiceQuery(transcript);
    };

    recognition.start();
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7,_#fdf2f8_35%,_#e0f2fe_70%,_#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 pb-16 pt-10">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
                Cognitive Calendar
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-slate-950">
                You don’t have time — you have capacity.
              </h1>
            </div>
            <span className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
              Meetings aren’t equal. Your calendar should know that.
            </span>
          </div>
          <p className="max-w-3xl text-base text-slate-600">
            Cognitive Calendar visualizes mental load, context switching, and recovery buffers
            so you can prevent burnout before it starts.
          </p>
        </header>

        <main className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl shadow-slate-200/50 backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Cognitive Flow</h2>
              {summary && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-500">Capacity remaining</span>
                  <span
                    className={clsx(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      summary.capacityRemaining < 20
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    )}
                  >
                    {Math.round(summary.capacityRemaining)} units
                  </span>
                </div>
              )}
            </div>
            <div className="mt-4">
              <FullCalendar
                plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                initialView="timeGridDay"
                height={650}
                headerToolbar={false}
                allDaySlot={false}
                slotMinTime="08:00:00"
                slotMaxTime="19:00:00"
                events={calendarEvents}
                eventClick={handleEventClick}
                eventContent={(info) => {
                  const extended = info.event.extendedProps as EventLoad | undefined;
                  if (!extended?.id) return null;
                  return (
                    <div className="flex h-full flex-col justify-between rounded-lg border border-white/30 bg-white/70 p-2 text-xs shadow-sm">
                      <div className="font-semibold text-slate-800">
                        {info.event.title}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>{Math.round(extended.mentalLoad * 100)}% load</span>
                        <span>+{Math.round(extended.contextSwitchCost * 100)}% switch</span>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700">
                Context switching spikes
              </h3>
              <div className="mt-3 space-y-3">
                {contextSwitches.map((pair) => (
                  <div
                    key={`${pair.from.id}-${pair.to.id}`}
                    className="flex items-center gap-3"
                  >
                    <div className="flex flex-1 flex-col rounded-2xl border border-slate-100 bg-white/70 px-4 py-2">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                        <span>{pair.from.title}</span>
                        <span>→</span>
                        <span>{pair.to.title}</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500"
                          style={{ width: `${Math.round(pair.to.contextSwitchCost * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="h-10 w-6 bg-[repeating-linear-gradient(135deg,_#f59e0b,_#f59e0b_4px,_#fce7f3_4px,_#fce7f3_8px)]" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-6">
            <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-slate-900">Daily capacity</h2>
              <p className="mt-1 text-sm text-slate-600">
                100 units of cognitive budget, depleted as meetings progress.
              </p>
              <div className="mt-4 space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-medium text-slate-600">
                      {formatTime(event.start)}
                    </div>
                    <div className="flex-1 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-slate-900"
                        style={{ width: `${Math.max(0, event.capacityRemaining)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      {Math.round(event.capacityRemaining)}
                    </span>
                  </div>
                ))}
              </div>
              {summary?.highRisk && (
                <div className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-700">
                  Capacity below 20%. Add recovery or move high-load meetings.
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-slate-900">
                Why is this meeting costly?
              </h2>
              {selectedEvent ? (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{selectedEvent.title}</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white">
                      {Math.round(selectedEvent.totalLoad * 100)}% load
                    </span>
                  </div>
                  <div className="space-y-2">
                    <MetricRow label="Meeting complexity" value={selectedEvent.explanation.complexity} />
                    <MetricRow label="Role load" value={selectedEvent.explanation.roleLoad} />
                    <MetricRow label="Emotional load" value={selectedEvent.explanation.emotionalLoad} />
                    <MetricRow label="Context switch" value={selectedEvent.explanation.contextSwitchCost} />
                    <MetricRow label="Social load" value={selectedEvent.explanation.socialLoad} />
                    <MetricRow
                      label="Recovery minutes"
                      value={selectedEvent.recoveryMinutes / 60}
                      suffix="h"
                    />
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
                    Tags: {selectedEvent.explanation.topicTags.join(", ") || "None"}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Select a meeting to see the breakdown.</p>
              )}
            </section>

            <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-slate-900">Voice assistant</h2>
              <p className="mt-1 text-sm text-slate-600">
                Calm, supportive guidance. Ask: “How heavy is my day?”
              </p>
              <div className="mt-4 flex items-center gap-3">
                <input
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-slate-400"
                  value={voiceQuery}
                  onChange={(event) => setVoiceQuery(event.target.value)}
                  placeholder="Ask about capacity or recovery..."
                />
                <button
                  onClick={() => runVoiceQuery()}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  disabled={voiceStatus === "loading"}
                >
                  {voiceStatus === "loading" ? "Thinking..." : "Ask"}
                </button>
                <button
                  onClick={handleVoiceCapture}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
                >
                  🎙️
                </button>
              </div>
              {voiceResponse && (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {voiceResponse}
                </div>
              )}
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}

function MetricRow({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span>{label}</span>
      <span className="font-semibold text-slate-800">
        {Math.round(value * 100) / 100}
        {suffix || ""}
      </span>
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function loadToColor(load: number) {
  if (load < 0.3) return "#86efac";
  if (load < 0.6) return "#fdba74";
  return "#fb7185";
}
