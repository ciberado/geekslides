# Notes and Todos

### .babelrc

Next line is added because by default parcel will tell babel to compile `async`/`await` expressions and 
without a transform runtime configured, the process will fail with an error.

```
  "plugins": ["@babel/plugin-transform-runtime"]
```

### package.json

Unless this plugin is added there is no simple way to retrieve static files from javascript when using
*parcel*'s webserver.

```
    "parcel-plugin-static-files-copy": "^2.3.1",
```

### TODO

* https://github.com/SoftwareBrothers/better-docs