# loadPemIntoKvm.sh

Shows how to load the contents of a file with newlines into a KVM as a value.

This will be useful when loading privatekey PEM's into an encrypted KVM for use within JWT policies. 

The key point in bash is to encode the newlines. Like this:

```
  ${pem_string//$'\n'/\\n}
```


