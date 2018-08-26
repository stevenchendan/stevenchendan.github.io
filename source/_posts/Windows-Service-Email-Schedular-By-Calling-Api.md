---
title: Windows Service Email Schedular(By Calling Api)
date: 2018-08-26 16:29:24
---

## Using Windows Service To Call API

---

Background: This week I set up a windows service to call my website API so that I can send unread notification weekly to our customers. I would like to share the process I have done so that you can save some time if you would like to do the same thing.

#### Why Windows Service?

I know there are some more continent ways to do the same thing especially on some cloud platform e.g. AWS, Azure... Because when I develop this feature I do not have the permission to access our AWS server and I am not familiar with AWS scheduler so that I choose windows service which is a bit of  legacy. I am pretty sure this is not the best option to do this Email Scheduler. I will keep updating this once I find a better solution.

#### Prerequisite:

You need to install visual studio(I use VS2017) and then create new **windows service** project(under Visual C#-> Windows Desktop -> Windows Service(.Net Framework))

#### Step 1:

In the **Service1.cs** file right click on the black area then click **add installer** then you should see two methods on the screen. Double click on any of them you should see this code below.

    public partial class ProjectInstaller : System.Configuration.Install.Installer
    {
        public ProjectInstaller()
        {
            InitializeComponent();
        }
    
        private void serviceProcessInstaller1_AfterInstall(object sender, InstallEventArgs e)
        {
    
        }
    
        private void serviceInstaller1_AfterInstall(object sender, InstallEventArgs e)
        {
    
        }
    }
Go to the definition of **InitializeComponent()** you should find the code snippiest below:

```
private void InitializeComponent()
{
    this.serviceProcessInstaller1 = new System.ServiceProcess.ServiceProcessInstaller();
    this.serviceInstaller1 = new System.ServiceProcess.ServiceInstaller();
    // 
    // serviceProcessInstaller1
    // 
    this.serviceProcessInstaller1.Password = null;
    this.serviceProcessInstaller1.Username = null;
    this.serviceProcessInstaller1.AfterInstall += new System.Configuration.Install.InstallEventHandler(this.serviceProcessInstaller1_AfterInstall);
    // 
    // serviceInstaller1
    // 
    this.serviceInstaller1.ServiceName = "Service1";
    this.serviceInstaller1.AfterInstall += new System.Configuration.Install.InstallEventHandler(this.serviceInstaller1_AfterInstall);
    // 
    // ProjectInstaller
    // 
    this.Installers.AddRange(new System.Configuration.Install.Installer[] {
    this.serviceProcessInstaller1,
    this.serviceInstaller1});
}
```

We can change some settings of our installer.

After changes my **InitializeComponent()** is like this:

private void InitializeComponent()
{
        this.serviceProcessInstaller1 = new System.ServiceProcess.ServiceProcessInstaller();
        this.serviceInstaller1 = new System.ServiceProcess.ServiceInstaller();
        // 
        // serviceProcessInstaller1
        // 
        **this.serviceProcessInstaller1.AccountSystem.ServiceProcess.ServiceAccount.LocalSystem;**
        this.serviceProcessInstaller1.Password = null;
        this.serviceProcessInstaller1.Username = null;
        this.serviceProcessInstaller1.AfterInstall += new System.Configuration.Install.InstallEventHandler(this.serviceProcessInstaller1_AfterInstall);
        // 
        // serviceInstaller1
        // 
        **this.serviceInstaller1.Description = "Test";**
        **this.serviceInstaller1.DisplayName = "Test";**
        **this.serviceInstaller1.ServiceName = "Test";**
        // 
        // ProjectInstaller
        // 
        this.Installers.AddRange(new System.Configuration.Install.Installer[] {
        this.serviceProcessInstaller1,
	this.serviceInstaller1});

}

You can notice that I changed four lines in this method. The first one is the installation method. And the other three is name and descriptions.



#### Step 2

After done with the installer we can move on to the main content of our service. Now let's go to the **service1.cs** file

