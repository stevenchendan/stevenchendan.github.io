---
date: "2020-10-16"
title: "[Step by Step]Switch Blog From Hexo To Gatsby + Netlify + Own domain"
category: "Coding"
tags: ['gatsby', 'Netlify']
banner: "/assets/bg/2.jpg"
---

# [Step by Step]Switch Blog From Hexo To Gatsby + Netlify + Own domain

After switched from Hexo to Gatsby. I would like to share my thoughts on this.

![Photo by [Lacie Slezak](https://unsplash.com/@nbb_photos?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on [Unsplash](https://unsplash.com/s/photos/blog?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText)](https://cdn-images-1.medium.com/max/8502/1*kp_rly_l4q4tygsXUL1-qQ.jpeg)*Photo by [Lacie Slezak](https://unsplash.com/@nbb_photos?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on [Unsplash](https://unsplash.com/s/photos/blog?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText)*

## Table of Content:

* **Hexo vs Gatsby** — the reason why I choose Gatsby

* **Github + Netlify + Godaddy(optional)** — The instruction to set up a blog from Scratch

## **Hexo vs Gatsby:**

**Popularity:**

From their GitHub pages, we can find gatsby is more popular than Hexo at this stage. I believe it is because of that react ecosystem is becoming stronger.

Also, developers never refuse to try out the latest technologies or frameworks including me.

I know there are a lot of companies that choose Gatsby to build their static pages in production so that I believe there will be possibilities that I might use it in the workplace.

![Hexo](https://cdn-images-1.medium.com/max/2000/1*rI1FgiNb2EY3Xaz6vBd-ow.png)*Hexo*

![gatsby](https://cdn-images-1.medium.com/max/2000/1*BSRgC0tMpIKsU4PpPpXhpw.png)*gatsby*

Below is my previous blog built by Hexo and the new blog build with Gatsby.

My Hexo Blog:

![My Previous Hexo blog](https://cdn-images-1.medium.com/max/3834/1*_cQIWdW6tLKDPIuXNu1CkQ.png)*My Previous Hexo blog*

My new gatsby blog Url: [schen.me](https://schen.me/)

![[schen.me](https://schen.me)](https://cdn-images-1.medium.com/max/3838/1*td0S1GIg5JnZZS3AWGe8LA.png)*[schen.me](https://schen.me)*

## Github + Netlify + Godaddy(optional)

Netlify: All-in-one platform for automating modern web projects. I believe Netlify is the best option for hosting a static website at this stage.

In this section I will share the steps of how I build my blog from scratch:

**Step 1**: **Choose your starter from the Gatsby community**

**1.1** After creating your GitHub project for your blog (not necessary to be a GitHub pages project)

**1.2** **Go to Gatsby community to find a starter**

* [https://www.gatsbyjs.com/starters/?v=2](https://www.gatsbyjs.com/starters/?v=2)

* [https://github.com/prayash/awesome-gatsby](https://github.com/prayash/awesome-gatsby)

If you have enough time you can also build your own starter.

1.3 **Generate project by using cli**

After choosing the starter you can run the command in your project folder. Make sure you have already installed gatsby-cli:

    npm install -g gatsby-cli

![starter example](https://cdn-images-1.medium.com/max/2704/1*DO5hBPdLc2NOGUeH8iQIVw.png)*starter example*

**Step 2**: Deploy your GitHub project to Netlify

**2.1 Add project to Netlify**

I recommend login to Netlify with your GitHub account. Then click this **New site from Git **to choose your blog project in Github.

![](https://cdn-images-1.medium.com/max/2692/1*CTAeCsH-KWChjzLT_3WG9w.png)

**2.2** **Go to Domain settings**

![](https://cdn-images-1.medium.com/max/2844/1*J-7Zu4Kkdxlw0dXow3FEvA.png)

**2.3 Add your own domain here**

when you add your domain you can choose either use Netlify’s DNS service or not. I have enabled the DNS service here.

![domain setting](https://cdn-images-1.medium.com/max/3042/1*2K-TuDBwyDFgHbiTOZzkjQ.png)*domain setting*

**2.4 Go to your Domain registry**

For me I use Godaddy. Here is the Godaddy DNS management page.

Make sure add the two record:

* the first one is IP address point to Netlify server

* the second one is CNAME point to your Netlifty project URL

![](https://cdn-images-1.medium.com/max/3464/1*e-oqWuS70hVhUJXHabzhgA.png)

You can easily find the Netlify balancer IP address from the Netlify website:

**Netlify’s** load balancer IP address: **104.198.14.52**

The CNAME is the highlighted one in your Domain management page.

![](https://cdn-images-1.medium.com/max/2876/1*Ttu5VATjW1BYL-dn0JRCPA.png)

Once your Netlify application point to your domain name and your domain DNS(godaddy) also points to your Netlify application. You are all good to go.

Blog Go Live!!!!

## Summary

Hope this post will save you some time while setting up your own blog with Netlify + GitHub + Godaddy.

Leave me comments if you find anything missing from this post. I will update it. **https://schen.me** is my blog. I prefer .me compared with .com given it is a perfect name for a blog.
