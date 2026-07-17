"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Code2,
  BrainCircuit,
  TerminalSquare,
  Circle,
  CheckCircle2,
  Search,
  ChevronDown,
  X,
  SlidersHorizontal,
  FilterX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { CODING_QUESTIONS } from "@/data/coding-questions";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function CodingClient({
  initialCompleted = {},
}: {
  initialCompleted?: Record<string, boolean>;
}) {
  const [activeTopic, setActiveTopic] = useState<string>("All");
  const [activeType, setActiveType] = useState<string>("All");
  const [activeDifficulty, setActiveDifficulty] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [completedQuestions, setCompletedQuestions] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const savedTopic = localStorage.getItem("coding-filter-topic");
    const savedType = localStorage.getItem("coding-filter-type");
    const savedDifficulty = localStorage.getItem("coding-filter-difficulty");
    if (savedTopic) setActiveTopic(savedTopic);
    if (savedType) setActiveType(savedType);
    if (savedDifficulty) setActiveDifficulty(savedDifficulty);

    const completed = { ...initialCompleted };
    for (const q of CODING_QUESTIONS) {
      if (localStorage.getItem(`completed-${q.id}`) === "true") {
        completed[q.id] = true;
      }
    }
    setCompletedQuestions(completed);

    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("coding-filter-topic", activeTopic);
      localStorage.setItem("coding-filter-type", activeType);
      localStorage.setItem("coding-filter-difficulty", activeDifficulty);
    }
  }, [activeTopic, activeType, activeDifficulty, mounted]);

  const handleClearAll = () => {
    setActiveTopic("All");
    setActiveType("All");
    setActiveDifficulty("All");
    setSearchQuery("");
  };

  const topics = [
    "All",
    ...Array.from(new Set(CODING_QUESTIONS.map((q) => q.topic))),
  ];

  const filteredQuestions = CODING_QUESTIONS.filter((q) => {
    const matchTopic = activeTopic === "All" || q.topic === activeTopic;
    const matchType = activeType === "All" || q.type === activeType;
    const matchDifficulty =
      activeDifficulty === "All" || q.difficulty === activeDifficulty;

    let matchSearch = true;
    if (searchQuery.trim()) {
      const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const textToMatch =
        `${q.title} ${q.topic} ${q.description}`.toLowerCase();
      matchSearch = words.every((word) => textToMatch.includes(word));
    }

    return matchTopic && matchType && matchDifficulty && matchSearch;
  });

  return (
    <div className="flex flex-col w-full max-w-5xl mx-auto gap-2">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 flex flex-col items-center text-center"
      >
        <Badge
          variant="outline"
          className="mb-6 text-primary bg-primary/10 border-primary/20 px-4 py-1 rounded-full text-xs font-mono uppercase tracking-widest shadow-[0_0_20px_-5px_rgba(var(--primary),0.3)]"
        >
          Engineering Arena
        </Badge>
        <h1 className="text-5xl md:text-6xl font-serif font-medium tracking-tight mb-6 text-white leading-tight">
          Elevate Your{" "}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary/60 underline underline-offset-4 decoration-1">
            Architecture
          </span>
        </h1>
        <p className="text-muted-foreground text-lg text-balance max-w-2xl mx-auto">
          Battle-test your algorithms and system designs in our premium,
          localized execution engine. Hand-graded by{" "}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary/60 font-bold font-mono">
            AI
          </span>
        </p>
      </motion.div>

      {/* Feature Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-8 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex flex-col sm:flex-row items-center justify-between shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <TerminalSquare className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">
              JS/TS Engine Active
            </p>
          </div>
        </div>
        <div className="mt-2 sm:mt-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            Zero-latency in-browser Monaco Editor
          </span>
        </div>
      </motion.div>

      {/* Controls Container: Search & Filters */}
      <div className="flex flex-col gap-4 mb-8 bg-card/30 border border-border/40 p-4 rounded-xl backdrop-blur-sm">
        {/* Row 1: Search and Reset */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
            <Input
              type="text"
              placeholder="Search challenges by title, topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full bg-[#111111]/80 border-border/40 focus:border-primary/50 text-sm placeholder:text-muted-foreground/50 transition-all rounded-lg"
            />
          </div>

          {(activeDifficulty !== "All" ||
            activeTopic !== "All" ||
            activeType !== "All" ||
            searchQuery) && (
            <Button
              onClick={handleClearAll}
              variant="outline"
              className="h-10 px-4 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-2 shrink-0 transition-all"
            >
              <FilterX className="size-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Row 2: Categorized Dropdown and Pill Groups */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          {/* Left side: Difficulty & Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Difficulty Pills */}
            <div className="flex bg-[#111111]/80 p-0.5 rounded-lg border border-border/40 gap-2">
              {["All", "Easy", "Medium", "Hard"].map((diff) => (
                <button
                  key={diff}
                  onClick={() => setActiveDifficulty(diff)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-semibold transition-all duration-200",
                    activeDifficulty === diff
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                  )}
                >
                  {diff === "All" ? "All Levels" : diff}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-border/40 hidden md:block" />

            {/* Type Pills */}
            <div className="flex bg-[#111111]/80 p-0.5 rounded-lg border border-border/40 gap-0.5">
              {[
                { value: "All", label: "All Types" },
                { value: "algorithmic", label: "Algorithmic", icon: Code2 },
                {
                  value: "brainstorm",
                  label: "Brainstorming",
                  icon: BrainCircuit,
                },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    onClick={() => setActiveType(t.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-semibold transition-all duration-200 flex items-center gap-1.5",
                      activeType === t.value
                        ? "bg-primary text-primary-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                    )}
                  >
                    {Icon && <Icon className="size-3" />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right side: Topic Dropdown */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="h-9 px-3 rounded-lg border border-border/40 bg-[#111111]/80 text-muted-foreground hover:text-foreground flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold transition-all hover:bg-[#161616] cursor-pointer">
                <SlidersHorizontal className="size-3" />
                Topic:{" "}
                <span className="text-primary font-bold">
                  {activeTopic === "All" ? "All Topics" : activeTopic}
                </span>
                <ChevronDown className="size-3 ml-1 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 bg-[#161616] border border-border/40 text-foreground p-1.5 rounded-lg shadow-xl"
              >
                {topics.map((topic) => (
                  <DropdownMenuItem
                    key={topic}
                    onClick={() => setActiveTopic(topic)}
                    className={cn(
                      "px-3 py-2 text-xs rounded-md cursor-pointer hover:bg-primary/10 hover:text-primary transition-all flex justify-between items-center outline-hidden",
                      activeTopic === topic
                        ? "text-primary bg-primary/5 font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {topic === "All" ? "All Topics" : topic}
                    {activeTopic === topic && (
                      <div className="size-1.5 rounded-full bg-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-2 min-h-100">
        <AnimatePresence mode="popLayout">
          {filteredQuestions.map((q, i) => (
            <motion.div
              key={`question-${q.id}`}
              layout
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <Link href={`/coding/${q.id}`} className="block group">
                <div className="flex flex-col md:flex-row md:items-center gap-4 bg-card border border-border px-4 py-3 rounded-xl transition-colors duration-200 hover:border-primary/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {completedQuestions[q.id] && (
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                      )}
                      <h3 className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {q.title}
                      </h3>
                      <Badge
                        className={
                          q.difficulty === "Easy"
                            ? "border-primary/25 bg-primary/10 text-[10px] uppercase text-primary"
                            : q.difficulty === "Medium"
                              ? "border-amber-500/25 bg-amber-500/10 text-[10px] uppercase text-amber-500"
                              : "border-red-500/25 bg-red-500/10 text-[10px] uppercase text-red-500"
                        }
                        variant="outline"
                      >
                        {q.difficulty}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Circle className="size-3 text-muted-foreground/50 invisible" />{" "}
                        {q.topic}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px] uppercase">
                        {q.type === "algorithmic" ? (
                          <>
                            <Code2 className="size-3 text-primary/70" />{" "}
                            Algorithmic
                          </>
                        ) : (
                          <>
                            <BrainCircuit className="size-3 text-primary/70" />{" "}
                            Brainstorm
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <ArrowRight className="size-4 text-muted-foreground/40 group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredQuestions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center text-muted-foreground"
          >
            <Code2 className="size-10 mx-auto mb-4 opacity-20" />
            <p>No challenges found for this category.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
