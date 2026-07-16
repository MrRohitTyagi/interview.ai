"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Sparkles, Terminal, Beaker, CheckCircle2, XCircle } from "lucide-react";
import Editor from "@monaco-editor/react";
import { toast } from "sonner";
import { submitBrainstormCodeAction, submitRunCodeAction } from "../../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CODING_QUESTIONS } from "@/data/coding-questions";
import { cn } from "@/lib/utils";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function CodingWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const question = CODING_QUESTIONS.find(q => q.id === id);
  if (!question) notFound();

  const [code, setCode] = useState(question.starterCode);
  const [logs, setLogs] = useState<string[]>(["Terminal ready. Waiting for execution..."]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [activeTab, setActiveTab] = useState<"testcases" | "terminal">("testcases");
  const [testResults, setTestResults] = useState<any[] | null>(null);
  const [activeCaseIndex, setActiveCaseIndex] = useState(0);

  const handleRunCode = async () => {
    setLogs(["Compiling and executing tests..."]);
    setTestResults(null);
    setActiveTab("testcases");
    setActiveCaseIndex(0);
    setIsSubmitting(true);
    
    const executionLogs: string[] = [];
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = (...args) => executionLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" "));
    console.error = (...args) => executionLogs.push("ERROR: " + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(" "));

    let isSuccess = false;
    let results = [];

    try {
      const dsInjection = "function ListNode(val, next) { this.val = (val===undefined ? 0 : val); this.next = (next===undefined ? null : next); }";
      
      const executionCode = [
         dsInjection,
         code,
         "if (typeof " + question.functionName + " !== 'undefined') { return " + question.functionName + "; }",
         "return null;"
      ].join("\n");
      
      const fn = new Function(executionCode);
      const userFunc = fn();
      
      if (typeof userFunc !== "function") {
         throw new Error("Function '" + question.functionName + "' is not defined or not returned properly. Make sure you haven't renamed the starter function!");
      }

      if (question.testCases) {
        let allPassed = true;
        for (const tc of question.testCases) {
          const parsedArgs = JSON.parse(tc.inputArgs);
          
          let actualResult;
          try {
             actualResult = userFunc(...parsedArgs);
          } catch (e: any) {
             actualResult = "Runtime Error: " + e.message;
          }
          
          const actualStr = JSON.stringify(actualResult);
          
          // Allow for slight differences in JSON serialization (spacing etc)
          let passed = false;
          try {
             passed = actualStr === tc.expectedOutput || JSON.stringify(JSON.parse(actualStr)) === JSON.stringify(JSON.parse(tc.expectedOutput));
          } catch {
             passed = actualStr === tc.expectedOutput;
          }
                         
          if (!passed) allPassed = false;
          
          results.push({
            input: tc.inputArgs,
            expected: tc.expectedOutput,
            actual: actualStr,
            passed
          });
        }
        isSuccess = allPassed;
      }
    } catch (err: any) {
      executionLogs.push("Runtime Error: " + err.message);
      results = [{ error: err.message }];
      setActiveTab("terminal");
    }

    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    
    setTestResults(results);
    setLogs([...executionLogs, "Syncing result to Database..."]);
    
    if (isSuccess) {
      toast.success("Solution Accepted! All test cases passed.", {
        duration: 4000,
        style: { backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399", borderColor: "rgba(16, 185, 129, 0.3)" },
        className: "font-medium"
      });
    }
    
    try {
      await submitRunCodeAction(question.id, code, isSuccess);
      setLogs(prev => [...prev, "✅ Result synced to Dashboard!"]);
    } catch (e) {
      setLogs(prev => [...prev, "❌ Failed to sync result to database. Are you logged in?"]);
    }
    
    setIsSubmitting(false);
  };

  const handleSubmitToAI = async () => {
    setIsSubmitting(true);
    const loadingToast = toast.loading("Gemini is reviewing your architecture...");
    try {
      const review = await submitBrainstormCodeAction(question.id, question.title, question.description, code);
      toast.dismiss(loadingToast);
      
      toast.success(
        <div className="flex flex-col gap-2 min-w-[300px]">
          <div className="font-bold flex items-center justify-between border-b border-primary/20 pb-2">
            <span>Score: {review.score}/100</span>
            <Badge variant={review.isOptimal ? "default" : "destructive"}>{review.isOptimal ? "Optimal" : "Suboptimal"}</Badge>
          </div>
          <div className="text-xs font-mono text-muted-foreground flex items-center justify-between mt-1">
            <span>Time: {review.timeComplexity}</span>
            <span>Space: {review.spaceComplexity}</span>
          </div>
          <p className="text-sm mt-2 leading-relaxed">{review.feedback}</p>
          {review.improvements.length > 0 && (
            <ul className="text-xs list-disc pl-4 mt-1 text-muted-foreground">
              {review.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
            </ul>
          )}
        </div>,
        { duration: 15000, className: "bg-card border border-primary/30" }
      );
    } catch (e) {
      toast.dismiss(loadingToast);
      toast.error("Failed to reach Gemini.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-foreground overflow-hidden font-sans">
      {/* Header */}
      <header className="h-14 border-b border-border/40 bg-[#111111] flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/coding" className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary">
            <ArrowLeft className="size-4" />
          </Link>
          <span className="font-semibold text-sm tracking-tight">{question.title}</span>
          <Badge variant="outline" className="font-mono text-[10px] uppercase ml-2 bg-secondary/30 border-border/50">
             {question.topic}
          </Badge>
        </div>
      </header>

      {/* Main Workspace Split - Resizable */}
      <div className="flex-1 w-full h-full overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="w-full h-full">
          
          {/* Left Panel: Problem Description */}
          <ResizablePanel defaultSize={35} minSize={20} className="bg-[#141414] flex flex-col h-full relative z-0">
            <div className="flex items-center justify-between mb-8 p-6 lg:p-8 pb-0">
              <h2 className="text-2xl font-serif font-medium text-white">{question.title}</h2>
              <Badge className={question.difficulty === "Easy" ? "bg-primary/10 text-primary border-primary/20" : question.difficulty === "Medium" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"} variant="outline">
                {question.difficulty}
              </Badge>
            </div>
            
            <div 
              className="text-sm leading-relaxed text-muted-foreground font-sans [&>p]:mb-4 [&_code]:font-mono [&_code]:bg-[#2a2a2a] [&_code]:text-primary/90 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_pre]:overflow-x-auto [&_pre]:max-w-full flex-1 overflow-y-auto p-6 lg:p-8 pt-0 min-w-0"
              dangerouslySetInnerHTML={{ __html: question.description }}
            />
          </ResizablePanel>

          <ResizableHandle withHandle className="w-1.5 bg-white/10 hover:bg-primary/50 transition-colors cursor-col-resize z-10" />

          {/* Right Panel: Monaco IDE & Terminal */}
          <ResizablePanel defaultSize={65} minSize={30} className="bg-[#1e1e1e] flex flex-col h-full relative z-0">
            <ResizablePanelGroup orientation="vertical" className="w-full h-full flex-col">
              
              {/* Editor Container */}
              <ResizablePanel defaultSize={60} minSize={20} className="relative group pt-2 flex flex-col">
                  <div className="flex-1 overflow-hidden">
                    <Editor
                      height="100%"
                      defaultLanguage="javascript"
                      theme="vs-dark"
                      value={code}
                      onChange={(val) => setCode(val || "")}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        wordWrap: "on",
                        padding: { top: 16 },
                        scrollBeyondLastLine: false,
                        smoothScrolling: true,
                      }}
                    />
                  </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="h-1.5 bg-white/10 hover:bg-primary/50 transition-colors cursor-row-resize z-10" />

              {/* Testcases & Execution Bar Container */}
              <ResizablePanel defaultSize={40} minSize={20} className="bg-[#0d0d0d] flex flex-col relative shadow-[0_-10px_30px_rgba(0,0,0,0.4)] z-0">
                  {/* Action Toolbar & Tabs */}
                  <div className="px-4 py-2 border-b border-border/40 flex items-center justify-between shrink-0 bg-[#161616]">
                     
                     <div className="flex items-center gap-4">
                        <button 
                          onClick={() => setActiveTab("testcases")}
                          className={cn("text-xs font-mono uppercase tracking-widest flex items-center gap-2 pb-1 border-b-2 transition-all", activeTab === "testcases" ? "text-white border-primary" : "text-muted-foreground border-transparent hover:text-white")}
                        >
                           <Beaker className="size-3.5" />
                           Testcases
                        </button>
                        <button 
                          onClick={() => setActiveTab("terminal")}
                          className={cn("text-xs font-mono uppercase tracking-widest flex items-center gap-2 pb-1 border-b-2 transition-all", activeTab === "terminal" ? "text-white border-primary" : "text-muted-foreground border-transparent hover:text-white")}
                        >
                           <Terminal className="size-3.5" />
                           Console
                        </button>
                     </div>
                     
                     <div className="flex gap-2 items-center">
                        {question.type === "algorithmic" ? (
                           <Button size="sm" onClick={handleRunCode} disabled={isSubmitting} className="gap-2 h-8 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)] hover:shadow-[0_0_20px_-3px_rgba(var(--primary),0.5)] transition-all">
                              <Play className="size-3.5 fill-current" />
                              {isSubmitting ? "Running..." : "Run Code"}
                           </Button>
                        ) : (
                           <Button size="sm" onClick={handleSubmitToAI} disabled={isSubmitting} className="gap-2 h-8 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-[0_0_15px_-3px_rgba(var(--primary),0.3)] transition-all">
                              <Sparkles className="size-3.5 fill-current" />
                              {isSubmitting ? "Reviewing..." : "Submit to AI"}
                           </Button>
                        )}
                     </div>
                  </div>
                  
                  {/* Tab Contents */}
                  <div className="flex-1 overflow-hidden relative bg-[#0a0a0a]">
                     
                     {/* Console Tab */}
                     {activeTab === "terminal" && (
                       <div className="absolute inset-0 overflow-y-auto p-4 font-mono text-[11px] text-muted-foreground">
                         {logs.map((log, i) => (
                           <div key={i} className="mb-2 whitespace-pre-wrap flex items-start gap-2">
                             <span className="text-border/50 select-none">&gt;</span>
                             <span className={log.includes("Error") || log.includes("❌") ? "text-red-400" : log.includes("✅") ? "text-primary" : ""}>{log}</span>
                           </div>
                         ))}
                       </div>
                     )}

                     {/* Testcases Tab */}
                     {activeTab === "testcases" && (
                        <div className="absolute inset-0 flex flex-col p-4">
                           {testResults ? (
                             testResults[0]?.error ? (
                               <div className="text-red-400 font-mono text-sm p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                                 🚨 {testResults[0].error}
                               </div>
                             ) : (
                               <div className="flex flex-col h-full">
                                 {/* Case Selector Pills */}
                                 <div className="flex gap-2 mb-4">
                                   {testResults.map((tc, idx) => (
                                      <button 
                                        key={idx}
                                        onClick={() => setActiveCaseIndex(idx)}
                                        className={cn("px-4 py-1.5 rounded-full text-xs font-medium font-mono flex items-center gap-2 transition-all", activeCaseIndex === idx ? "bg-[#222] text-white" : "bg-[#111] text-muted-foreground hover:bg-[#1a1a1a]")}
                                      >
                                        {tc.passed ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-red-500" />}
                                        Case {idx + 1}
                                      </button>
                                   ))}
                                 </div>
                                 
                                 {/* Active Case Details */}
                                 {testResults[activeCaseIndex] && (
                                   <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                                     <div>
                                        <div className="text-xs font-mono text-muted-foreground mb-1">Input:</div>
                                        <div className="bg-[#1a1a1a] p-3 rounded-lg border border-white/5 font-mono text-sm text-gray-300 break-all">
                                           {testResults[activeCaseIndex].input}
                                        </div>
                                     </div>
                                     <div>
                                        <div className="text-xs font-mono text-muted-foreground mb-1">Expected Output:</div>
                                        <div className="bg-[#1a1a1a] p-3 rounded-lg border border-white/5 font-mono text-sm text-gray-300 break-all">
                                           {testResults[activeCaseIndex].expected}
                                        </div>
                                     </div>
                                     <div>
                                        <div className="text-xs font-mono text-muted-foreground mb-1">Actual Output:</div>
                                        <div className={cn("p-3 rounded-lg border font-mono text-sm break-all", testResults[activeCaseIndex].passed ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400")}>
                                           {testResults[activeCaseIndex].actual}
                                        </div>
                                     </div>
                                   </div>
                                 )}
                               </div>
                             )
                           ) : (
                             <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground h-full opacity-50">
                               <Beaker className="size-8 mb-2 opacity-50" />
                               <p className="text-sm font-mono">Run your code to view test case results</p>
                             </div>
                           )}
                        </div>
                     )}
                  </div>
              </ResizablePanel>

            </ResizablePanelGroup>
          </ResizablePanel>

        </ResizablePanelGroup>
      </div>
    </div>
  );
}
