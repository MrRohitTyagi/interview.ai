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
       Because this is a conceptual architecture question, there are many correct ways to implement it. Your code will not be strictly unit-tested. Instead, it will be sent to our AI Engine for a structural review of your Time/Space Complexity and Software Engineering patterns.
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
       Consider using a Token Bucket or Sliding Window Log algorithm. Your code will be reviewed by our AI Engine for architecture choices and memory limits.
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
       Consider edge cases like how you handle the execution context (<code>this</code>) and arguments. Your code will be reviewed by our AI Engine.
    </p>
  </div>
</div>
    `,
    starterCode: `function debounce(func, wait) {
  // Your code here
}`
  },
  {
    id: "7",
    title: "7. Flatten Deeply Nested Array",
    difficulty: "Medium",
    topic: "JavaScript & Arrays",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Write a function that flattens a deeply nested array.</p>
  <p>The function should take in an array and a <code>depth</code> parameter. It should return a new array with all sub-array elements concatenated into it recursively up to the specified depth.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> arr = [1, 2, [3, 4, [5, 6]]], depth = 1
<span class="text-muted-foreground">Output:</span> [1, 2, 3, 4, [5, 6]]</pre>
    </div>
  </div>
  <div>
    <p class="font-semibold text-white mb-2">Example 2:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> arr = [1, 2, [3, 4, [5, 6]]], depth = 2
<span class="text-muted-foreground">Output:</span> [1, 2, 3, 4, 5, 6]</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function flat(arr, depth) {
  // Your code here
  
}`,
    functionName: "flat",
    testCases: [
      { inputArgs: `[[1, 2, [3, 4, [5, 6]]], 1]`, expectedOutput: `[1,2,3,4,[5,6]]` },
      { inputArgs: `[[1, 2, [3, 4, [5, 6]]], 2]`, expectedOutput: `[1,2,3,4,5,6]` },
      { inputArgs: `[[1, 2, 3], 1]`, expectedOutput: `[1,2,3]` }
    ]
  },
  {
    id: "8",
    title: "8. Deep Clone an Object",
    difficulty: "Medium",
    topic: "JavaScript & Objects",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Write a function that deeply clones a JavaScript object.</p>
  <p>The object might contain nested objects, arrays, and primitive values. Your clone should not maintain any reference to the original object.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> obj = { a: 1, b: { c: 2 } }
<span class="text-muted-foreground">Output:</span> { a: 1, b: { c: 2 } }</pre>
    </div>
  </div>
  <div>
    <p class="font-semibold text-white mb-2">Example 2 (with Array):</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> obj = [1, 2, { a: 3 }]
<span class="text-muted-foreground">Output:</span> [1, 2, { a: 3 }]</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function deepClone(obj) {
  // Your code here
  
}`,
    functionName: "deepClone",
    testCases: [
      { inputArgs: `[{"a":1,"b":{"c":2}}]`, expectedOutput: `{"a":1,"b":{"c":2}}` },
      { inputArgs: `[[1,2,{"a":3}]]`, expectedOutput: `[1,2,{"a":3}]` },
      { inputArgs: `[{"nested":{"deep":true}}]`, expectedOutput: `{"nested":{"deep":true}}` }
    ]
  },
  {
    id: "9",
    title: "9. Valid Parentheses",
    difficulty: "Easy",
    topic: "Logic & Stacks",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given a string <code>s</code> containing just the characters <code>'('</code>, <code>')'</code>, <code>'{'</code>, <code>'}'</code>, <code>'['</code> and <code>']'</code>, determine if the input string is valid.</p>
  <p>An input string is valid if:</p>
  <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
    <li>Open brackets must be closed by the same type of brackets.</li>
    <li>Open brackets must be closed in the correct order.</li>
    <li>Every close bracket has a corresponding open bracket of the same type.</li>
  </ul>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> s = "()[]{}"
<span class="text-muted-foreground">Output:</span> true</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function isValid(s) {
  // Your code here
  
}`,
    functionName: "isValid",
    testCases: [
      { inputArgs: `["()[]{}"]`, expectedOutput: `true` },
      { inputArgs: `["(]"]`, expectedOutput: `false` },
      { inputArgs: `["([)]"]`, expectedOutput: `false` },
      { inputArgs: `["{[]}"]`, expectedOutput: `true` }
    ]
  },
  {
    id: "10",
    title: "10. Find Missing Number",
    difficulty: "Easy",
    topic: "Logic & Math",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given an array of integers <code>nums</code> containing unique numbers starting from 0, return <em>the missing number in the sequence from <code>0</code> to the maximum number in the array</em>.</p>
  <p>If all numbers from <code>0</code> to the maximum number are present in the array, return <code>null</code>.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> nums = [3,0,1]
<span class="text-muted-foreground">Output:</span> 2
<span class="text-muted-foreground">Explanation:</span> The sequence from 0 to 3 is [0,1,2,3]. The missing number is 2.</pre>
    </div>
  </div>
  <div>
    <p class="font-semibold text-white mb-2">Example 2:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> nums = [0,1]
<span class="text-muted-foreground">Output:</span> null
<span class="text-muted-foreground">Explanation:</span> The sequence from 0 to 1 is [0,1]. All numbers are present, so return null.</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function missingNumber(nums) {
  // Your code here
  
}`,
    functionName: "missingNumber",
    testCases: [
      { inputArgs: `[[3,0,1]]`, expectedOutput: `2` },
      { inputArgs: `[[0,1]]`, expectedOutput: `null` },
      { inputArgs: `[[4,0,2,1]]`, expectedOutput: `3` }
    ]
  },
  {
    id: "11",
    title: "11. Chunk Array",
    difficulty: "Easy",
    topic: "JavaScript & Arrays",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given an array <code>arr</code> and a chunk size <code>size</code>, return a chunked array.</p>
  <p>A chunked array contains the original elements split into sub-arrays of length <code>size</code>. The last sub-array may contain fewer than <code>size</code> elements if the array length is not evenly divisible.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> arr = [1, 2, 3, 4, 5], size = 2
<span class="text-muted-foreground">Output:</span> [[1, 2], [3, 4], [5]]</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function chunk(arr, size) {
  // Your code here
  
}`,
    functionName: "chunk",
    testCases: [
      { inputArgs: `[[1,2,3,4,5], 2]`, expectedOutput: `[[1,2],[3,4],[5]]` },
      { inputArgs: `[[1,2,3,4,5,6,7,8], 3]`, expectedOutput: `[[1,2,3],[4,5,6],[7,8]]` },
      { inputArgs: `[[1,2], 5]`, expectedOutput: `[[1,2]]` }
    ]
  },
  {
    id: "12",
    title: "12. Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    topic: "Logic & Sliding Window",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given a string <code>s</code>, find the length of the longest substring without repeating characters.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> s = "abcabcbb"
<span class="text-muted-foreground">Output:</span> 3
<span class="text-muted-foreground">Explanation:</span> The answer is "abc", with the length of 3.</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function lengthOfLongestSubstring(s) {
  // Your code here
  
}`,
    functionName: "lengthOfLongestSubstring",
    testCases: [
      { inputArgs: `["abcabcbb"]`, expectedOutput: `3` },
      { inputArgs: `["bbbbb"]`, expectedOutput: `1` },
      { inputArgs: `["pwwkew"]`, expectedOutput: `3` },
      { inputArgs: `[""]`, expectedOutput: `0` }
    ]
  },
  {
    id: "13",
    title: "13. Product of Array Except Self",
    difficulty: "Medium",
    topic: "Arrays & Math",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given an integer array <code>nums</code>, return an array <code>answer</code> such that <code>answer[i]</code> is equal to the product of all the elements of <code>nums</code> except <code>nums[i]</code>.</p>
  <p>You must write an algorithm that runs in <code>O(n)</code> time and without using the division operation.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> nums = [1,2,3,4]
<span class="text-muted-foreground">Output:</span> [24,12,8,6]</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function productExceptSelf(nums) {
  // Your code here
  
}`,
    functionName: "productExceptSelf",
    testCases: [
      { inputArgs: `[[1,2,3,4]]`, expectedOutput: `[24,12,8,6]` },
      { inputArgs: `[[-1,1,0,-3,3]]`, expectedOutput: `[0,0,9,0,0]` }
    ]
  },
  {
    id: "14",
    title: "14. Design a React Rate Limiter Hook",
    difficulty: "Medium",
    topic: "React Architecture",
    type: "brainstorm",
    description: `
<div class="space-y-4">
  <p>Design a custom React hook <code>useRateLimiter</code> that limits the rate of function executions.</p>
  <p>Explain your choice between Debounce and Throttle for a search input autocomplete scenario, and write down the hook skeleton.</p>
  
  <div class="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-2">
    <div class="flex items-center gap-2 font-medium text-primary text-sm">
       AI Brainstorming Question
    </div>
    <p class="text-xs text-primary/80 leading-relaxed">
       Discuss memory leaks, cleanup functions, and dependency arrays. Your code will be reviewed by our AI Engine.
    </p>
  </div>
</div>
    `,
    starterCode: `import { useEffect, useRef } from 'react';

function useRateLimiter(callback, delay) {
  // Discuss and design your approach
  
}`
  },
  {
    id: "15",
    title: "15. System Design: Image Carousel",
    difficulty: "Medium",
    topic: "System Design",
    type: "brainstorm",
    description: `
<div class="space-y-4">
  <p>Design an Image Carousel component from scratch using vanilla JavaScript or a framework.</p>
  <p>What data structures would you use to maintain state? How would you handle infinite looping, lazy loading images, and swipe gestures on mobile?</p>
  
  <div class="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-2">
    <div class="flex items-center gap-2 font-medium text-primary text-sm">
       AI Brainstorming Question
    </div>
    <p class="text-xs text-primary/80 leading-relaxed">
       Write out your component API, state model, and key rendering lifecycle steps. Your system design will be reviewed by our AI Engine.
    </p>
  </div>
</div>
    `,
    starterCode: `class ImageCarousel {
  constructor(images, containerId) {
    this.images = images;
    // Outline your state and methods
  }
}`
  },
  {
    id: "16",
    title: "16. Web Performance Optimization",
    difficulty: "Medium",
    topic: "Web Architecture",
    type: "brainstorm",
    description: `
<div class="space-y-4">
  <p>A web application's initial load time is unacceptably slow (over 6 seconds). The Lighthouse score is 35/100 for Performance.</p>
  <p>What are the key metrics you would look at (e.g., LCP, CLS, FID, TTFB), and what are the specific techniques (Code Splitting, Tree Shaking, Service Workers, Caching, Image Optimization) you would apply to bring it under 2 seconds?</p>
  
  <div class="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-2">
    <div class="flex items-center gap-2 font-medium text-primary text-sm">
       AI Brainstorming Question
    </div>
    <p class="text-xs text-primary/80 leading-relaxed">
       Write down a comprehensive audit checklist and optimization strategy.
    </p>
  </div>
</div>
    `,
    starterCode: `// 1. Audit Strategy
// 2. Resource Optimization
// 3. Network & Caching
// 4. Rendering Patterns (SSR/SSG)`
  },
  {
    id: "17",
    title: "17. Implement Event Emitter",
    difficulty: "Medium",
    topic: "System Design",
    type: "brainstorm",
    description: `
<div class="space-y-4">
  <p>Design and implement a basic <code>EventEmitter</code> class in JavaScript/TypeScript.</p>
  <p>It should support the following methods: <code>on(eventName, listener)</code>, <code>emit(eventName, ...args)</code>, and <code>off(eventName, listener)</code>.</p>
  
  <div class="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-2">
    <div class="flex items-center gap-2 font-medium text-primary text-sm">
       AI Brainstorming Question
    </div>
    <p class="text-xs text-primary/80 leading-relaxed">
       Consider edge cases like multiple identical listeners, removing listeners while emitting, and context binding.
    </p>
  </div>
</div>
    `,
    starterCode: `class EventEmitter {
  constructor() {
    this.events = {};
  }
  
  on(eventName, listener) {
    
  }
  
  emit(eventName, ...args) {
    
  }
  
  off(eventName, listener) {
    
  }
}`
  },
  {
    id: "18",
    title: "18. Design Infinite Scroll",
    difficulty: "Medium",
    topic: "Frontend System Design",
    type: "brainstorm",
    description: `
<div class="space-y-4">
  <p>Design an <strong>Infinite Scroll</strong> component or utility in React/JavaScript that fetches and appends more items as the user scrolls to the bottom of the page.</p>
  <p>Explain how you would implement this using:
    <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
      <li>The <code>scroll</code> event listener approach vs. the <strong>Intersection Observer API</strong>.</li>
      <li>How to prevent layout thrashing and handle loading states.</li>
      <li>How to throttle scroll events or clean up observers to prevent memory leaks.</li>
    </ul>
  </p>
  
  <div class="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-2">
    <div class="flex items-center gap-2 font-medium text-primary text-sm">
       AI Brainstorming Question
    </div>
    <p class="text-xs text-primary/80 leading-relaxed">
       Discuss threshold triggers, request deduplication, and virtualization (windowing) for rendering thousands of items. Your response will be reviewed by the AI Engine.
    </p>
  </div>
</div>
    `,
    starterCode: `import { useEffect, useRef } from 'react';

function useInfiniteScroll(onLoadMore) {
  // Outline your state, refs, and IntersectionObserver setup
  
}`
  },
  {
    id: "19",
    title: "19. Palindrome Check",
    difficulty: "Easy",
    topic: "Logic & Strings",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given a string <code>s</code>, return <code>true</code> if it is a palindrome, or <code>false</code> otherwise.</p>
  <p>A string is a palindrome if it reads the same forward and backward, ignoring case and non-alphanumeric characters.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> s = "A man, a plan, a canal: Panama"
<span class="text-muted-foreground">Output:</span> true
<span class="text-muted-foreground">Explanation:</span> "amanaplanacanalpanama" is a palindrome.</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function isPalindrome(s) {
  // Your code here
  
}`,
    functionName: "isPalindrome",
    testCases: [
      { inputArgs: `["A man, a plan, a canal: Panama"]`, expectedOutput: `true` },
      { inputArgs: `["race a car"]`, expectedOutput: `false` },
      { inputArgs: `[" "]`, expectedOutput: `true` }
    ]
  },
  {
    id: "20",
    title: "20. Fibonacci Number",
    difficulty: "Easy",
    topic: "Logic & Math",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>The Fibonacci numbers, commonly denoted <code>F(n)</code>, form a sequence called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1.</p>
  <p>Given <code>n</code>, calculate <code>F(n)</code>.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> n = 2
<span class="text-muted-foreground">Output:</span> 1</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function fib(n) {
  // Your code here
  
}`,
    functionName: "fib",
    testCases: [
      { inputArgs: `[2]`, expectedOutput: `1` },
      { inputArgs: `[3]`, expectedOutput: `2` },
      { inputArgs: `[4]`, expectedOutput: `3` }
    ]
  },
  {
    id: "21",
    title: "21. FizzBuzz",
    difficulty: "Easy",
    topic: "Logic",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Given an integer <code>n</code>, return a string array <code>answer</code> (1-indexed) where:</p>
  <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
    <li><code>answer[i] === "FizzBuzz"</code> if <code>i</code> is divisible by 3 and 5.</li>
    <li><code>answer[i] === "Fizz"</code> if <code>i</code> is divisible by 3.</li>
    <li><code>answer[i] === "Buzz"</code> if <code>i</code> is divisible by 5.</li>
    <li><code>answer[i] === i.toString()</code> if none of the above conditions are true.</li>
  </ul>
</div>
    `,
    starterCode: `function fizzBuzz(n) {
  // Your code here
  
}`,
    functionName: "fizzBuzz",
    testCases: [
      { inputArgs: `[3]`, expectedOutput: `["1","2","Fizz"]` },
      { inputArgs: `[5]`, expectedOutput: `["1","2","Fizz","4","Buzz"]` },
      { inputArgs: `[15]`, expectedOutput: `["1","2","Fizz","4","Buzz","Fizz","7","8","Fizz","Buzz","11","Fizz","13","14","FizzBuzz"]` }
    ]
  },
  {
    id: "22",
    title: "22. Title Case a Sentence",
    difficulty: "Easy",
    topic: "Logic & Strings",
    type: "algorithmic",
    description: `
<div class="space-y-4">
  <p>Return the provided string with the first letter of each word capitalized. Make sure the rest of the word is in lower case.</p>
  <div>
    <p class="font-semibold text-white mb-2">Example 1:</p>
    <div class="overflow-x-auto w-full">
      <pre class="bg-secondary/50 p-4 rounded-lg border border-border/50 text-sm font-mono whitespace-pre w-max min-w-full">
<span class="text-muted-foreground">Input:</span> str = "I'm a little tea pot"
<span class="text-muted-foreground">Output:</span> "I'm A Little Tea Pot"</pre>
    </div>
  </div>
</div>
    `,
    starterCode: `function titleCase(str) {
  // Your code here
  
}`,
    functionName: "titleCase",
    testCases: [
      { inputArgs: `["I'm a little tea pot"]`, expectedOutput: `"I'm A Little Tea Pot"` },
      { inputArgs: `["sHoRt AnD sWeEt"]`, expectedOutput: `"Short And Sweet"` }
    ]
  }
];
