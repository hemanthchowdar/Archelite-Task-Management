// Polyfill Array.prototype.toReversed for compatibility with older Node.js versions (< v20)
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    // Return a shallow copy reversed
    return [...this].reverse();
  };
}
