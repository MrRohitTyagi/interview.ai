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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CODING_QUESTIONS } from "@/data/coding-questions";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function CodingClient({ initialCompleted = {} }: { initialCompleted?: Record<string, boolean> }) {
  const [activeTopic, setActiveTopic] = useState<string>("All");
  const [activeType, setActiveType] = useState<string>("All");
  const [mounted, setMounted] = useState(false);
  const [completedQuestions, setCompletedQuestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const savedTopic = localStorage.getItem("coding-filter-topic");
    const savedType = localStorage.getItem("coding-filter-type");
    if (savedTopic) setActiveTopic(savedTopic);
    if (savedType) setActiveType(savedType);
    
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
    }
  }, [activeTopic, activeType, mounted]);
  
  const topics = ["All", ...Array.from(new Set(CODING_QUESTIONS.map(q => q.topic)))];
  const types = ["All", "algorithmic", "brainstorm"];
  
  const filteredQuestions = CODING_QUESTIONS.filter(q => {
    const matchTopic = activeTopic === "All" || q.topic === activeTopic;
    const matchType = activeType === "All" || q.type === activeType;
    return matchTopic && matchType;
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

        {/* Filters */}
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-2">
            {topics.map((topic, i) => (
              <motion.button
                key={`topic-${i}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
                onClick={() => setActiveTopic(topic)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 border backdrop-blur-sm",
                  activeTopic === topic 
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]" 
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-secondary"
                )}
              >
                {topic}
              </motion.button>
            ))}
          </div>

          <div className="hidden md:block h-6 w-px bg-border mx-2" />

          <div className="flex flex-wrap items-center gap-2">
            {types.map((type, i) => (
              <motion.button
                key={`type-${i}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.05 }}
                onClick={() => setActiveType(type)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 border backdrop-blur-sm flex items-center gap-1.5 capitalize",
                  activeType === type 
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_-5px_rgba(var(--primary),0.5)]" 
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground hover:bg-secondary"
                )}
              >
                {type === "algorithmic" && <Code2 className="size-3" />}
                {type === "brainstorm" && <BrainCircuit className="size-3" />}
                {type === "algorithmic" ? "Algorithmic" : type === "brainstorm" ? "Brainstorming" : "All Types"}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div className="flex flex-col gap-2 min-h-[400px]">
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
                        <Circle className="size-3 text-muted-foreground/50" /> {q.topic}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[10px] uppercase">
                        {q.type === "algorithmic" ? (
                          <><Code2 className="size-3 text-primary/70" /> Algorithmic</>
                        ) : (
                          <><BrainCircuit className="size-3 text-primary/70" /> Brainstorm</>
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
