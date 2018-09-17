---
title: Scheduler in .Net Core 2.1 -- Hangfire Setup
date: 2018-09-14 08:43:58
tags:[".Net Core", "Hangfire", "Scheduler"]
---

### Scheduler in .Net Core 2.1 -- Hangfire tutorial

---

#### Background: 

I used to setup my project scheduler by using windows service, mostly sending emails, then I find a better library to do this task -- Hangfire. There are multiple reasons, the first is Hangfire is free!!! and then it provide dashboard to monitor and control your scheduled tasks, the last point is it is easy to setup.

---

#### Options:

Before we get into this Hangfire tutorial make sure you compare all the libraries otherwise you need to refactor your application which is waste of time. After compare these options and ask a friend, I decided to use Hangfire to handle the scheduling emails.

**Scheduler and Job**

- [Chroniton.NetCore](https://github.com/leosperry/Chroniton) - Lightweight robust library for running tasks(jobs) on schedules.
- [Coravel](https://github.com/jamesmh/coravel) - .Net Core meets Laravel: Scheduling, Queuing, etc.
- [FluentScheduler](https://github.com/fluentscheduler/FluentScheduler) - Automated job scheduler with fluent interface.
- [Gofer.NET](https://github.com/brthor/Gofer.NET) - Easy C# API for Distributed Background Tasks/Jobs for .NET Core. Inspired by celery for python.
- [HangfireIO](https://github.com/HangfireIO/Hangfire) - Easy way to perform fire-and-forget, delayed and recurring tasks inside ASP.NET apps [http://hangfire.io](http://hangfire.io).
- [LiquidState](https://github.com/prasannavl/LiquidState) - Efficient asynchronous and synchronous state machines for .NET.
- [NCrontab](https://github.com/atifaziz/NCrontab) - Crontab for .NET.
- [quartznet](https://github.com/quartznet/quartznet/) - Quartz Enterprise Scheduler .NET [http://www.quartz-scheduler.net](http://www.quartz-scheduler.net).
- [stateless](https://github.com/dotnet-state-machine/stateless) - Simple library for creating state machines in C# code.

This list comes from [awesome-dotnet-core](https://github.com/thangchung/awesome-dotnet-core)

---

Step 1: Installation

I use NUGET package to install this library. I install these three library.

```c#
<PackageReference Include="Hangfire.AspNetCore" Version="1.6.20" />
<PackageReference Include="Hangfire.Dashboard.Authorization" Version="2.1.0" />
<PackageReference Include="Hangfire.SqlServer" Version="1.6.20" />
```
You can search them in NuGet Package Manager. The version number does not matter.

Because I use .Net Core 2.1 so that I install Hangfire.AspNetCore rather than Hangfire please make sure you select the right one for your project. The Hangfire.Dashboard.Authorization is to implement the security feature which means it is optional and the SqlServer is a must-have.

Step 2: Startup Configuration

After the installation let's go to the **Startup.cs** file then you need to do the following things.

Under the 

```C#
public void ConfigureServices(IServiceCollection services)
```

Add the following code. These codes is to configure the Hangfire can access your database. 

```c#
services.AddHangfire(config =>
                config.UseSqlServerStorage(Configuration.GetConnectionString("DefaultConnection")));
```



Under the Configure

```c#
public void Configure(IApplicationBuilder app, IHostingEnvironment env)
```

Add the following code.

```c#
app.UseHangfireDashboard();
app.UseHangfireServer();
```

After you run your application you should be able to see your hangfire dashboard now.

https://{{yourBaseUrl}/hangfire



{% asset_img "hangFire.PNG" "Dashboard" %}



Step 3: Security Setup

Before we put this into production we need to make sure that this page is not accessible by others.

This is my new **Configure** method in **Startup.cs**

```c#
public void Configure(IApplicationBuilder app, IHostingEnvironment env)
{

    

    app.UseAuthentication();
    app.UseHangfireServer();
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = new[] { new HangfireAuthorizationFilter() },
    });
    
    app.UseSignalR(routes =>
    {
        routes.MapHub<ChatHub>("/chat");
        routes.MapHub<NotificationHub>("/notification");
    });

    app.UseMvc(routes =>
    {
        routes.MapRoute(
            "default",
            "{controller=Home}/{action=Index}/{id?}");
        });

}




```

And My HangfireAuthorizationFilter is like this you can use your own code.

```c#
public class HangfireAuthorizationFilter : IDashboardAuthorizationFilter
{

    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();

        return httpContext.User.IsAdmin();
    }

}


```



Step 4: Hangfire Controller

The next step is to write the Hangfire jobs this depends on your needs I write the code in my Hangfire controller, but write it in your startup.cs is ok but not easy to maintain.

Here is the example of recurrent jobs.

http://docs.hangfire.io/en/latest/background-methods/performing-recurrent-tasks.html



Step 5: Common mistakes

To be continue



Related Resources:

These are some useful resources, maybe you will find them useful.

https://www.hanselman.com/blog/HowToRunBackgroundTasksInASPNET.aspx

https://dotnetthoughts.net/integrate-hangfire-with-aspnet-core/

http://docs.hangfire.io/en/latest/configuration/using-sql-server.html

https://codingsight.com/hangfire-task-scheduler-for-net/

https://samueleresca.net/2017/12/background-tasks-in-asp-net-core/

http://www.talkingdotnet.com/integrate-hangfire-with-asp-net-core-web-api/