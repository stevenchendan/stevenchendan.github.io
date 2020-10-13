---
date: "2018-09-10"
title: "Improve Website Performance by using bundling(.Net Core 2.1)"
category: "Coding"
tags: ['.net core']
banner: "/assets/bg/3.jpg"
---

### How to do bundling in .Net Core Project

---

Background: These days I would like to improve our website performance I have learned that there are some ways like code splitting, bundling and so on. I will start with bundling. So that I would like to share the process about how I did it. I do not promise this is the best practice but I hope this post can save you sometime once you would like to do the same thing.



#### Step 1:

My project is a .Net Core project. Before you read my post I hope your can read the office document about how to do the bundling. Here is the official website: 

[Bundle in .Net Core]: https://docs.microsoft.com/en-us/aspnet/core/client-side/bundling-and-minification?tabs=visual-studio%2Caspnetcore2x&amp;view=aspnetcore-2.1

If you find this official document is not helpful let's continue.



#### Step 2 : 

Let's go to the file called **bundleconfig.json** which is the file we can bundle our files together.

{% asset_img "bundleFile.PNG" "File Location" %}



In this file you can see the existing code 

```
[
  {
    "outputFileName": "wwwroot/js/site.min.js",
    "inputFiles": [
      "wwwroot/js/site.js"
    ],
    "minify": {
      "enabled": true,
      "renameLocals": false
    }
  },
  {
    "outputFileName": "wwwroot/css/site.min.css",
    "inputFiles": [
      "wwwroot/css/site.css"
    ],
    "minify": {
      "enabled": true,
      "renameLocals": false
    }
  }
]

```

This code is pretty much straightforward I think I do not need to explain anything. 

#### Step 3: Download Extension

I recommend you to use this extension called **Bundler & Minifier** this is recommended by the official document. Here is the link of this extension: [Bundle & Minifier]: https://marketplace.visualstudio.com/items?itemName=MadsKristensen.BundlerMinifier you can also use nuget package to install it.

Once you download this extension successfully we can select multiple .js or .css to bundle them together. After select them right click then you will find the option called: Bundle & Minifier this is the one will help you bundle your files.

{% asset_img "bundleRightClick.png" "Bundle Option" %}

Remeber that please do not change the order of the .js or .css becaue the loading sequence matters in our project. Before you do this bundle I think spilit your code is a good choice otherwise the landing page will be slow.

#### Step 4: Bundle & Minifer Setting

After we do the bundling  we can double check it in the **bundleconfig.json** 
Here is a example of mine bundleconfig file: 
```
[
  {
    "outputFileName": "wwwroot/js/site.min.js",
    "inputFiles": [
      "wwwroot/js/main.js",
      "wwwroot/js/lodash.min.js",
      "wwwroot/js/jodit.min.js",
      "wwwroot/js/bootstrap-datepicker.js",
      "wwwroot/js/axios.min.js",
      "wwwroot/js/toastr.min.js",
      "wwwroot/js/moment.min.js",
      "wwwroot/js/daterangepicker.js",
      "wwwroot/Scripts/SidebarScripts.js",
      "wwwroot/js/manifest.js",
      "wwwroot/js/slick.min.js",
      "wwwroot/js/site.min.js"
    ],
    "minify": {
      "enabled": true,
      "renameLocals": false
    }
  },
  {
    "outputFileName": "wwwroot/css/site.min.css",
    "inputFiles": [
      "wwwroot/css/font-awesome.min.css",
      "wwwroot/lib/bootstrap/dist/css/bootstrap.css",
      "wwwroot/css/angular-material.css",
      "wwwroot/css/styles.css",
      "wwwroot/css/emoticons.css",
      "wwwroot/css/vue-multiselect.min.css",
      "wwwroot/lib/Croppie/croppie.css",
      "wwwroot/css/jodit.min.css",
      "wwwroot/css/datepicker3.css",
      "wwwroot/css/toastr.min.css",
      "wwwroot/css/site.css"
    ],
    "minify": {
      "enabled": true,
      "renameLocals": false
    }
  }
]
```

#### Step 5: Build Bundle File

After you finish do the setting we can build the bundle files.

{% asset_img "bundleRightClick.png" "Bundle Option" %}

Click on the **Task Runner Explorer** options you can set the build time of the bundle files 

{% asset_img "taskRunnerExplorer.png" "Task Runnder" %}

you can update all files right now or you can set the build time of each file.

#### Conclusion

Please do remember include your bundle files(e.g. site.min.css or site.min.js ....) in your layout file
Now you can check from browser if your bundle file works or not.





















































































































































