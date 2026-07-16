export type CodingQuestion = {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  description: string; // HTML allowed
  starterCode: string;
  type: "algorithmic" | "brainstorm";
  functionName?: string;
  testCases?: {
    inputArgs: string;
    expectedOutput: string;
  }[];
}

export const CODING_QUESTIONS: CodingQuestion[] = [
  {
    id: "1",
    title: "1. Two Sum",
    difficulty: "Easy",
    topic: "Arrays & Hashing",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.</p>
  <p>You may assume that each input would have <strong><em>exactly</em> one solution</strong>, and you may not use the same element twice.</p>
  <p>You can return the answer in any order.</p>
  
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> nums = [2,7,11,15], target = 9
<span class="text-muted-foreground">Output:</span> [0,1]
<span class="text-muted-foreground">Explanation:</span> Because nums[0] + nums[1] == 9, we return [0, 1].</pre>
    </div>
  </div>

  <div>
    <p class="font-semibold text-white mb-2">Example 2:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> nums = [3,2,4], target = 6
<span class="text-muted-foreground">Output:</span> [1,2]</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function twoSum(nums, target) {
  // Write your highly optimized solution here
  
}`,
    functionName: "twoSum",
    testCases: [
      { inputArgs: `[[2,7,11,15], 9]`, expectedOutput: `[0,1]` },
      { inputArgs: `[[3,2,4], 6]`, expectedOutput: `[1,2]` },
      { inputArgs: `[[3,3], 6]`, expectedOutput: `[0,1]` }
    ]
  },
  {
    id: "2",
    title: "2. Implement PubSub",
    difficulty: "Medium",
    topic: "System Design",
    type: "brainstorm",
    description: `
<div class="space-y-4">
  <p>Implement a basic <strong>Publish-Subscribe (PubSub)</strong> class in JavaScript.</p>
  <p>The class should act as an Event Bus and implement two core methods:</p>
  <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
    <li><code>subscribe(eventName, callback)</code>: Registers a callback for an event.</li>
    <li><code>publish(eventName, data)</code>: Triggers all registered callbacks for the event.</li>
  </ul>
  
  <div class="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-2">
    <div class="flex items-center gap-2 font-medium text-primary text-sm">
       AI Brainstorming Question
    </div>
    <p class="text-xs text-primary/80 leading-relaxed">
       Because this is a conceptual architecture question, there are many correct ways to implement it. Your code will not be strictly unit-tested. Instead, it will be sent to Gemini for a structural review of your Time/Space Complexity and Software Engineering patterns.
    </p>
  </div>
</div>
    `,
    starterCode: `class PubSub {
  constructor() {
    this.events = {};
  }

  subscribe(event, callback) {
    // Implement subscription logic
  }

  publish(event, data) {
    // Implement publish logic
  }
}`
  },
  {
    id: "3",
    title: "3. Reverse Linked List",
    difficulty: "Medium",
    topic: "Linked Lists",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given the <code>head</code> of a singly linked list, reverse the list, and return <em>the reversed list</em>.</p>
  
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> head = [1,2,3,4,5]
<span class="text-muted-foreground">Output:</span> [5,4,3,2,1]</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `/**
 * Definition for singly-linked list.
 * function ListNode(val, next) {
 *     this.val = (val===undefined ? 0 : val)
 *     this.next = (next===undefined ? null : next)
 * }
 */
function reverseList(head) {
  // Your code here
}`,
    functionName: "reverseList",
    testCases: [
      { inputArgs: `[{"val":1,"next":{"val":2,"next":{"val":3,"next":null}}}]`, expectedOutput: `{"val":3,"next":{"val":2,"next":{"val":1,"next":null}}}` }
    ]
  },
  {
    id: "4",
    title: "4. Design a Rate Limiter",
    difficulty: "Hard",
    topic: "System Design",
    type: "brainstorm",
    description: `
<div class="space-y-4">
  <p>Design a <strong>Rate Limiter</strong> class in JavaScript.</p>
  <p>Your rate limiter should allow a maximum of <code>N</code> requests per <code>timeWindow</code> (in milliseconds). It should implement a method <code>allowRequest(userId)</code> which returns <code>true</code> if the request is allowed and <code>false</code> if it is dropped.</p>
  
  <div class="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-2">
    <div class="flex items-center gap-2 font-medium text-primary text-sm">
       AI Brainstorming Question
    </div>
    <p class="text-xs text-primary/80 leading-relaxed">
       Consider using a Token Bucket or Sliding Window Log algorithm. Your code will be reviewed by Gemini for architecture choices and memory limits.
    </p>
  </div>
</div>
    `,
    starterCode: `class RateLimiter {
  constructor(maxRequests, timeWindowMs) {
    this.maxRequests = maxRequests;
    this.timeWindowMs = timeWindowMs;
  }

  allowRequest(userId) {
    // Return true or false
  }
}`
  },
  {
    id: "5",
    title: "5. Flat Array",
    difficulty: "Easy",
    topic: "Arrays",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Write a function that takes a multi-dimensional array and returns a one-dimensional (flattened) array.</p>
  
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> arr = [1, [2, [3, [4, 5]]]]
<span class="text-muted-foreground">Output:</span> [1, 2, 3, 4, 5]</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function flatArray(arr) {
  // Your code here
}`,
    functionName: "flatArray",
    testCases: [
      { inputArgs: `[[1, [2, [3, [4, 5]]]]]`, expectedOutput: `[1,2,3,4,5]` },
      { inputArgs: `[[1, 2, 3]]`, expectedOutput: `[1,2,3]` }
    ]
  },
  {
    id: "6",
    title: "6. Implement Debounce",
    difficulty: "Medium",
    topic: "System Design",
    type: "brainstorm",
    description: `
<div class="space-y-4">
  <p>Implement a <strong>Debounce</strong> function in JavaScript.</p>
  <p>The function should delay invoking the provided function until after <code>wait</code> milliseconds have elapsed since the last time the debounced function was invoked.</p>
  
  <div class="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-2">
    <div class="flex items-center gap-2 font-medium text-primary text-sm">
       AI Brainstorming Question
    </div>
    <p class="text-xs text-primary/80 leading-relaxed">
       Consider edge cases like how you handle the execution context (<code>this</code>) and arguments. Your code will be reviewed by Gemini.
    </p>
  </div>
</div>
    `,
    starterCode: `function debounce(func, wait) {
  // Your code here
}`
  }
];
