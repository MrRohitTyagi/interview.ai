"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Code2,
  BrainCircuit,
  TerminalSquare,
  Circle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CODING_QUESTIONS } from "@/data/coding-questions";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function CodingListPage() {
  const [activeTopic, setActiveTopic] = useState<string>("All");
  
  const topics = ["All", ...Array.from(new Set(CODING_QUESTIONS.map(q => q.topic)))];
  
  const filteredQuestions = activeTopic === "All" 
    ? CODING_QUESTIONS 
    : CODING_QUESTIONS.filter(q => q.topic === activeTopic);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground font-sans relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none opacity-50" />

      <div className="max-w-5xl mx-auto py-20 px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-16 flex flex-col items-center text-center"
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-12 bg-[#121212]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-1 shadow-2xl"
        >
          <div className="bg-primary/5 rounded-xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between border border-primary/20">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-black/40 shadow-inner">
                <TerminalSquare className="size-6 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-white">
                  JavaScript / TypeScript Engine Active
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Zero-latency in-browser Web Workers & Monaco Editor
                </p>
              </div>
            </div>
            <div className="relative group/badge">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-primary/50 rounded-lg blur opacity-50 group-hover/badge:opacity-75 transition duration-500 animate-pulse"></div>
              <Badge variant="secondary" className="relative mt-4 sm:mt-0 font-mono text-[10px] uppercase tracking-wider bg-black hover:bg-black/90 text-primary border border-primary/30 px-3 py-1.5 shadow-xl">
                More languages coming soon
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {topics.map((topic, i) => (
            <motion.button
              key={topic}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.05 }}
              onClick={() => setActiveTopic(topic)}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border",
                activeTopic === topic 
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)]" 
                  : "bg-transparent text-muted-foreground border-white/10 hover:border-primary/50 hover:text-white hover:bg-primary/5"
              )}
            >
              {topic}
            </motion.button>
          ))}
        </div>

        {/* Question List Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 text-xs font-mono uppercase tracking-widest text-muted-foreground border-b border-white/10 mb-4">
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-5">Title</div>
          <div className="col-span-2">Difficulty</div>
          <div className="col-span-2">Topic</div>
          <div className="col-span-2 text-right">Engine</div>
        </div>

        {/* Questions */}
        <div className="flex flex-col gap-3 min-h-[400px]">
          <AnimatePresence mode="popLayout">
            {filteredQuestions.map((q, i) => (
              <motion.div
                key={q.id}
                layout
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
              <Link href={`/coding/${q.id}`} className="block group">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#111111] border border-white/5 p-4 md:p-5 md:px-6 rounded-2xl hover:bg-[#161616] hover:border-primary/30 hover:shadow-[0_0_30px_-10px_rgba(var(--primary),0.15)] transition-all duration-300">
                  {/* Status */}
                  <div className="hidden md:flex col-span-1 justify-center">
                    <Circle className="size-5 text-white/10 group-hover:text-white/20 transition-colors" />
                  </div>

                  {/* Title */}
                  <div className="col-span-1 md:col-span-5 flex items-center gap-3">
                    <h3 className="font-medium text-base text-gray-200 group-hover:text-white transition-colors">
                      {q.title}
                    </h3>
                  </div>

                  {/* Difficulty */}
                  <div className="col-span-1 md:col-span-2">
                    <Badge
                      className={
                        q.difficulty === "Easy"
                          ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                          : q.difficulty === "Medium"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                      }
                      variant="outline"
                    >
                      {q.difficulty}
                    </Badge>
                  </div>

                  {/* Topic */}
                  <div className="col-span-1 md:col-span-2">
                    <span className="text-sm text-muted-foreground group-hover:text-gray-300 transition-colors">
                      {q.topic}
                    </span>
                  </div>

                  {/* Engine Type */}
                  <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-end gap-4">
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] uppercase text-muted-foreground bg-black/40 border-white/10"
                    >
                      {q.type === "algorithmic" ? (
                        <span className="flex items-center gap-1.5">
                          <Code2 className="size-3" /> Algorithmic
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <BrainCircuit className="size-3" /> Brainstorm
                        </span>
                      )}
                    </Badge>
                    <ArrowRight className="size-4 text-white/20 group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
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
    </div>
  );
}
