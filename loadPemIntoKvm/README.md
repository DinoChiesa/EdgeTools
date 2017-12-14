# loadPemIntoKvm.sh

Shows how to load the contents of a file with newlines into a KBM as a value.

The key point in bash is to encode the newlines. Like this:

```
  ${pem_string//$'\n'/\\n}
```


