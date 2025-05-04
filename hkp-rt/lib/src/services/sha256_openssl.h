#pragma once

#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <memory>

#include <openssl/evp.h>

struct OpenSSLFree {
    void operator()(void* ptr) {
        EVP_MD_CTX_free((EVP_MD_CTX*)ptr);
    }
};

template <typename T>
using OpenSSLPointer = std::unique_ptr<T, OpenSSLFree>;

std::string sha256(const std::string& unhashed) {
    OpenSSLPointer<EVP_MD_CTX> context(EVP_MD_CTX_new());

    if(context.get() == NULL) {
        return "";
    }

    if(!EVP_DigestInit_ex(context.get(), EVP_sha256(), NULL)) {
        return "";
    }

    if(!EVP_DigestUpdate(context.get(), unhashed.c_str(), unhashed.length())) {
        return "";
    }

    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int lengthOfHash = 0;

    if(!EVP_DigestFinal_ex(context.get(), hash, &lengthOfHash)) {
        return "";
    }

    std::stringstream ss;
    for(unsigned int i = 0; i < lengthOfHash; ++i)
    {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }

    return ss.str();
}
