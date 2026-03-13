---
title: "Welcome to My Blog"
description: "A first post to kick things off — why I started this blog and what you can expect to find here."
pubDate: 2026-03-12
heroImage: "/images/og-default.jpg"
tags: ["personal", "writing"]
featured: true
---

This is the beginning of something I've been meaning to do for a while. A space to write down thoughts, share things I've learned, and document the journey.

## Why a blog?

I've always found that writing helps me think more clearly. When I try to explain an idea in writing, I discover gaps in my understanding that I wouldn't have noticed otherwise.

> "Writing is thinking. To write well is to think clearly. That's why it's so hard." — David McCullough

## What to expect

I plan to write about:

- Things I'm learning — technology, ideas, books
- Thinking out loud — unpolished explorations of topics I find interesting
- Occasional projects and experiments

## A simple code example

Here's a small function I like, just to test that code highlighting works:

```javascript
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

Nothing fancy. Just a place to write. Welcome aboard.
