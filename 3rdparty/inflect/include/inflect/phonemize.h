#pragma once

#include <string>

namespace inflect {

// Phonemizer producing byte-identical output to the Python frontend's
//
//   phonemize(text, language="en-us", backend="espeak", strip=True,
//             preserve_punctuation=True, with_stress=True)
//
// followed by inflect_vits_frontend._apply_phoneme_overrides().
//
// espeak-ng itself drops punctuation, so phonemizer hides the marks before
// calling it and splices them back afterwards. That preserve/restore dance is
// reimplemented here; calling espeak_TextToPhonemes directly would silently
// lose every comma and full stop, which the model needs for prosody.
class Phonemizer {
 public:
  // `data_path` is the espeak-ng-data directory. Pass an empty string to let
  // espeak use its compiled-in default location.
  explicit Phonemizer(const std::string& data_path = std::string(),
                      const std::string& voice = "en-us");
  ~Phonemizer();

  Phonemizer(const Phonemizer&) = delete;
  Phonemizer& operator=(const Phonemizer&) = delete;

  // Normalized text in, IPA phoneme string out.
  std::string Phonemize(const std::string& normalized_text) const;

 private:
  // espeak-ng keeps global state, so only one voice can be active per process.
  std::string voice_;
};

}  // namespace inflect
