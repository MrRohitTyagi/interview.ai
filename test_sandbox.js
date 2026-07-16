const code = `function twoSum(nums, target) {
  // Write your highly optimized solution here
  
}`;
const dsInjection = `function ListNode(val, next) { this.val = (val===undefined ? 0 : val); this.next = (next===undefined ? null : next); }\n`;
const functionName = "twoSum";
try {
  const fn = new Function(dsInjection + code + "\nreturn typeof " + functionName + " !== 'undefined' ? " + functionName + " : null;");
  console.log("Success:", typeof fn());
} catch (e) {
  console.error("Error:", e.message);
}
