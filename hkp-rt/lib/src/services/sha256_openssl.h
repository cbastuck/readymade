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

inline std::string sha256(const std::string& unhashed) {
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

// The same hash over content that arrives in pieces — a file too large to hold.
class Sha256Stream {
public:
    Sha256Stream() : m_context(EVP_MD_CTX_new()) {
        m_ok = m_context && EVP_DigestInit_ex(m_context.get(), EVP_sha256(), NULL);
    }

    void update(const char* data, size_t size) {
        m_ok = m_ok && EVP_DigestUpdate(m_context.get(), data, size);
    }

    // The hash as lower-case hex, or empty when it could not be computed.
    std::string finish() {
        unsigned char hash[EVP_MAX_MD_SIZE];
        unsigned int lengthOfHash = 0;
        if(!m_ok || !EVP_DigestFinal_ex(m_context.get(), hash, &lengthOfHash)) {
            return "";
        }
        std::stringstream ss;
        for(unsigned int i = 0; i < lengthOfHash; ++i)
        {
            ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
        }
        return ss.str();
    }

private:
    OpenSSLPointer<EVP_MD_CTX> m_context;
    bool m_ok = false;
};
