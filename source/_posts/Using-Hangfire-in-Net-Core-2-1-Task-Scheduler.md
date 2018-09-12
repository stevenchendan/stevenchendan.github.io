---
title: Using Hangfire in .Net Core 2.1 -- Task Scheduler
date: 2018-09-12 17:13:44
tags:[".Net Core", "Hangfire", "Backend Task", "Task Scheduler"]
---

## Implement Hangfire in .Net Core 2.1

---

Background:

In my current project I used to use windows service to handle the task scheduling (e.g. sending emails). But then I find Hangfire is a better way to do this and it is understandable for my manager as well because it provide a dashboard for monitoring jobs. And the most important one is it is free unless you use the PRO version. In this post I will give you a step by step tutorial to set it up and also some common mistakes or questions in terms of Hangfire.

---



