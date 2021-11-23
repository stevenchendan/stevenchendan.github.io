---
category: 'blog'
cover: './cover.jpg'
title: 'Impress Front-End Interviewer — Closure'
description: 'Understand Closure Within 5 minutes'
date: '2021-11-24'
tags: ['Closure', 'JavaScript']
published: true
---

# Impress Front-End Interviewer — Closure

Why do we need Closure and how to use Closure Properly. More importantly, how to impress your interviewer.

![](https://cdn-images-1.medium.com/max/4480/1*cqrnVqjPn_T3u31LOpzRvQ.png)

Let’s spend several minutes together to understand why closure is a popular interview question and why it is important for Front-end Developers.

## 1 What is Closure:

### 1.1 Closure Definition:

Let’s look at the two official definitions first:

From MDN:

**closure** is a combination of a function bundled together (enclosed) with references to its surrounding state (the **lexical environment**). In other words, a closure gives you access to an outer function’s scope from an inner function. In JavaScript, closures are created every time a function is created, at function creation time.\_

From Wikipedia:

In [programming languages](https://en.wikipedia.org/wiki/Programming_language), a **closure**, also **lexical closure** or **function closure**, is a technique for implementing [lexically scoped](https://en.wikipedia.org/wiki/Lexically_scoped) [name binding](https://en.wikipedia.org/wiki/Name_binding) in a language with [first-class functions](https://en.wikipedia.org/wiki/First-class_function)

From Professional JavaScript:

**Closures** are functions that have access to variables from another function’s scope

I believe you can have at least a basic understanding now. let us look at the following code to make sure we are on the same page.

![](https://cdn-images-1.medium.com/max/2320/1*mtyGDCQCswhyc6LlHIoNtg.png)

As we can see here we have access to the outside variable. This is a typical closure. Easy to understand right? let’s move on.

### 1.2 Where does Closure Comes From

Please remember the goal of this article is to impress your interviewer so that we not only need to understand what is Closure also we need to understand where it comes from:

Here are the milestones of Closure.

![a brief history of closure](https://cdn-images-1.medium.com/max/5760/1*OEZJDAilhZknbZPS7jAU2A.png)_a brief history of closure_

We can clearly see that the history of Closure is longer than JavaScript it is not only important for front-end developers but also for all software engineers. To understand what closure is created for we need to go back to 1960.

![Closure mostly used in Functional Programming](https://cdn-images-1.medium.com/max/2000/1*ecZ1OHsakZbcL3eVVhoOxA.png)_Closure mostly used in Functional Programming_

For a software engineer, closure is an important concept, especially in functional programming. If we take look at the trend in react community we can find functional programming is becoming more and more popular these days.

Actually, even if you are using Java or C++, which does not support closure you can achieve the same purpose but not that straightforward.

## 2. When to use Closure:

### **2.1 Nested Function**

The most common scenario for closure is the **nested function** in JavaScript.

![nested function](https://cdn-images-1.medium.com/max/2828/1*eGRraXU3OqQiz7iNMnbS5Q.png)_nested function_

As you can see in this example the inner function has access to the **outVariable**.

### 2.2 Object-Oriented Programming in JavaScript

TBC

### 2.3 IIFE

TBC

## 3. Closure Interview Questions

TBC

## 4. Conclusion:

Congratulation your understanding about the closure is better than 80% of Front-end developers. Hope you like this article. Don’t forget to practice if you want to fully understand closure.

## 5. Reference:

[**Closure (computer programming) - Wikipedia**
*In programming languages, a closure, also lexical closure or function closure, is a technique for implementing…*en.wikipedia.org](<https://en.wikipedia.org/wiki/Closure_(computer_programming)>)
[**Closures - JavaScript | MDN**
*A closure is the combination of a function bundled together (enclosed) with references to its surrounding state (the…*developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures)
