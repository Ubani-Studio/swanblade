# Swanblade — Remix Engine Directions

> Multi-model audio mutation pipeline. Upload a track, choose an engine, get something strange back.

## Current State

**Stable Audio Open 1.0** — SDEdit-style audio-to-audio via manual VAE encode → noise → denoise loop. Optional LoRA adapter for style. Runs on Modal A10G (24GB).

Working: `lora_train.py::remix_audio()` → `/api/remix` → `remix-panel.tsx`

---

## Architecture: Multi-Engine Remix

The remix pipeline should support swappable engines. Each engine takes audio in and returns audio out, but the mutation mechanism differs fundamentally:

```
Input Audio
    │
    ├─→ [SDEdit Engines]     — VAE encode → add noise → denoise with prompt
    │     ├─ Stable Audio Open (current)
    │     ├─ AudioLDM 2
    │     └─ EzAudio
    │
    ├─→ [Masked Token Engines] — Tokenize → mask regions → regenerate tokens
    │     ├─ VampNet
    │     └─ MaskGCT (speech domain)
    │
    ├─→ [Conditioning Engines] — Audio conditions generation (no noise injection)
    │     ├─ Stable Audio ControlNet
    │     └─ AudioX (multimodal)
    │
    ├─→ [Latent Space Engines]  — Encode → manipulate latent → decode
    │     ├─ PERI (RAVE)
    │     └─ Music2Latent
    │
    └─→ [Flow Matching Engines] — ODE-based continuous transform
          ├─ AudioLCM (2-step)
          ├─ FlashAudio (1-step)
          └─ F5-TTS (speech infilling)
```

Each engine is a separate Modal function. The API route picks the engine based on user selection. The UI shows engine-specific controls (strength slider for SDEdit, mask pattern for VampNet, etc).

---

## Engine Catalog

### 1. VampNet — Masked Acoustic Token Modeling

**Why this is the most interesting one.** Instead of smooth diffusion-based interpolation, VampNet masks random chunks of tokenized audio and regenerates them. The discrete token approach produces genuinely alien mutations — it doesn't blend, it *replaces*.

| Detail | Value |
|--------|-------|
| Repo | [hugofloresgarcia/vampnet](https://github.com/hugofloresgarcia/vampnet) |
| Checkpoints | [Zenodo](https://zenodo.org/records/8136629) (2.8GB) + [HuggingFace](https://huggingface.co/hugggof/vampnet) |
| Architecture | Coarse transformer (20L, 1280d, 20h) + Coarse-to-Fine (16L) over DAC tokens |
| Codec | DAC-based, 44.1kHz, 14 codebooks (4 coarse + 10 fine), ~57Hz token rate |
| VRAM | ~4-8 GB inference |
| License | MIT (code), CC BY-NC-SA 4.0 (weights) |
| Python | 3.9 required (madmom dependency) |

**Mutation modes:**
- **Vamping** — periodic mask: keep every Nth timestep, regenerate the rest. Controls how much structure survives.
- **Inpainting** — mask a time region, regenerate from surrounding context.
- **Compression** — keep coarse codebooks, regenerate fine detail.
- **Full regeneration** — mask everything, generate from scratch (unconditional).

**Integration approach:**
```python
import vampnet
interface = vampnet.interface.Interface.default()
codes = interface.encode(signal)
mask = interface.build_mask(codes, signal, periodic_prompt=7, upper_codebook_mask=3)
output_tokens = interface.vamp(codes, mask, temperature=1.0)
output_signal = interface.decode(output_tokens)
```

**Key dependencies:** `lac` (DAC fork), `descript-audiotools`, `wavebeat`, `madmom` — all from Hugo's GitHub forks, not PyPI. Needs isolated env.

**UI controls:** Periodic prompt (1-16), upper codebook mask (0-14), temperature, number of sampling steps (default 36).

**Related:** Hugo's latest work **Sketch2Sound** (Dec 2024, ICASSP 2025) adds time-varying pitch/loudness/brightness control via latent diffusion transformers. Not yet in VampNet repo but TODO says "add sketch2sound finetuning".

---

### 2. EzAudio — DiT with Native Editing + Inpainting

Built-in audio editing and inpainting. No manual SDEdit wiring needed. Uses 1D waveform VAE instead of mel spectrogram (cleaner latent space).

| Detail | Value |
|--------|-------|
| Repo | [haidog-yaqub/EzAudio](https://github.com/haidog-yaqub/EzAudio) |
| Checkpoints | [OpenSound/EzAudio](https://huggingface.co/OpenSound/EzAudio) |
| Architecture | DiT + 1D waveform VAE + CFG rescaling |
| VRAM | ~16-24 GB |
| License | Open |
| Status | Interspeech 2025 Oral |

**Capabilities:** Text-to-audio, audio editing (change specific elements), audio inpainting (fill masked regions). The editing mode is what makes this interesting — describe what to change, it changes just that.

---

### 3. AudioX — Anything-to-Audio (Multimodal)

Unified DiT that accepts text, video, image, AND audio as input. Feed it your track + a text prompt, or a video clip, and it generates audio.

| Detail | Value |
|--------|-------|
| Repo | [ZeyueT/AudioX](https://github.com/ZeyueT/AudioX) |
| Checkpoints | [HKUSTAudio/AudioX](https://huggingface.co/HKUSTAudio/AudioX) |
| Architecture | Multimodal Adaptive Fusion DiT, trained on 7M+ samples |
| VRAM | ~24 GB |
| License | CC-BY-NC |
| Status | ICLR 2026 |

**Capabilities:** Text-to-audio, video-to-audio, image-to-audio, audio inpainting, music completion. The cross-modal input is unique — you could feed it a photo and get a soundscape, or feed it video of a performance and get accompanying audio.

---

### 4. AudioLDM 2 — Latent Diffusion (SDEdit Style)

Mature latent diffusion model. No native audio-to-audio pipeline in diffusers, but SDEdit works via manual VAE encode → noise → denoise (same pattern as our current Stable Audio remix, just different model).

| Detail | Value |
|--------|-------|
| Model IDs | `cvssp/audioldm2` (base, 1.1B), `cvssp/audioldm2-large` (1.5B), `cvssp/audioldm2-music` |
| Package | `diffusers` (AudioLDM2Pipeline) |
| VRAM | ~6-8 GB (base fp16), ~8-10 GB (large fp16) |
| Output | 16kHz mono |
| Audio-to-Audio | Manual via latents param (SDEdit) |

**Limitation:** 16kHz mono output — significantly lower quality than Stable Audio's 44.1kHz stereo. Better for sound FX than music.

---

### 5. Stable Audio ControlNet — Audio-Conditioned Generation

ControlNet adapter for Stable Audio Open's DiT. Conditions generation on input audio without the noise injection of SDEdit. Produces outputs that are structurally related to the input but not derived from noising it.

| Detail | Value |
|--------|-------|
| Repo | [EmilianPostolache/stable-audio-controlnet](https://github.com/EmilianPostolache/stable-audio-controlnet) |
| Architecture | DiT ControlNet (depth_factor=0.5), conditions on Stable Audio Open |
| VRAM | 16 GB |
| Trained on | MusDB, MoisesDB |

**Different from SDEdit:** SDEdit destroys then rebuilds. ControlNet *conditions* — the input audio guides generation without being partially destroyed. Better for style transfer where you want the output to rhyme with the input's structure.

---

### 6. Music2Latent — Consistency Autoencoder

Not a generation model — a latent space backbone. Encodes 44.1kHz audio to ~10Hz latent sequence (64 channels) with single-step reconstruction via consistency model training.

| Detail | Value |
|--------|-------|
| Repo | [SonyCSLParis/music2latent](https://github.com/SonyCSLParis/music2latent) |
| Architecture | Consistency autoencoder, ~4400x compression |
| VRAM | ~8 GB |
| License | CC BY-NC 4.0 |

**Use case:** Pair with any latent-space manipulation. Encode through Music2Latent → interpolate/transform latents → decode. Could also combine: encode with Music2Latent, manipulate, decode with a different model's decoder for cross-model mutations.

---

### 7. PERI (Your RAVE Model) — Personal Latent Space

Your RAVE v2_small model trained on your corpus. This is the most "you" engine — every mutation passes through a latent space shaped by your specific music.

| Detail | Value |
|--------|-------|
| Model | `peri_v2_small_20260225_1542` |
| Architecture | RAVE v2 small (CAPACITY=48) |
| Status | Training in tmux session `peri` |
| Deployment | nn~ (Max/MSP), Neutone (VST) |
| VRAM | Minimal (runs on CPU even) |

**Use case:** Encode any audio through PERI's encoder → manipulate latent (add noise, interpolate between two inputs, time-stretch latent) → decode. Everything that comes out is colored by your training data. Could chain: VampNet mutation → PERI re-encode → decode for double mutation through your sonic DNA.

---

### 8. AudioLCM — 2-Step Fast Generation

Consistency-distilled AudioLDM. Generates in 2 inference steps instead of hundreds. 333x faster than real-time on a 4090.

| Detail | Value |
|--------|-------|
| Repo | [Text-to-Audio/AudioLCM](https://github.com/Text-to-Audio/AudioLCM) |
| Checkpoints | [liuhuadai/AudioLCM](https://huggingface.co/liuhuadai/AudioLCM) |
| Steps | 2 (vs. 100-200 for diffusion) |
| VRAM | ~16 GB |

**Use case:** Fast iteration. When you want to try 20 mutations quickly to find a direction, then run the full model. Also useful for live performance contexts where latency matters.

---

### 9. MAGNeT — Fast Non-Autoregressive (Text-to-Audio Only)

Part of Meta's AudioCraft. Masked parallel decoding — 7x faster than MusicGen. However, **no audio-to-audio support**. Text-conditioned only.

| Detail | Value |
|--------|-------|
| Package | `audiocraft` (`pip install audiocraft`) |
| Model IDs | `facebook/magnet-small-10secs` (300M), `facebook/magnet-medium-30secs` (1.5B) |
| VRAM | ~4-6 GB (small), ~16 GB (medium) |
| Speed | ~1.5s for 10s audio on A100 |

**Use case:** Fast text-to-audio generation alongside remix. Not a remix engine itself, but useful as a complementary generator.

---

### 10. FlashAudio / MeanAudio — Single-Step Flow Matching

One-step generation via rectified flows. 400x faster than real-time. Emerging research, code availability limited.

| Model | Repo | Status |
|-------|------|--------|
| FlashAudio | [flashaudio-tta.github.io](https://flashaudio-tta.github.io/) | Paper only (ACL 2025) |
| MeanAudio | [xiquan-li/MeanAudio](https://github.com/xiquan-li/MeanAudio) | Weights coming |

---

### 11. F5-TTS — Flow Matching (Speech Domain)

Zero-shot voice cloning and speech editing via flow matching. DiT architecture with ConvNeXt text refinement.

| Detail | Value |
|--------|-------|
| Repo | [SWivid/F5-TTS](https://github.com/SWivid/F5-TTS) |
| Install | `pip install f5-tts` |
| License | MIT (code), CC-BY-NC (models) |
| VRAM | ~16 GB |

**Use case:** Voice mutation specifically. Clone a vocal, edit it, infill missing sections.

---

### 12. MaskGCT — Masked Generative Codec Transformer (Speech)

Non-autoregressive, no forced alignment. Two-stage: semantic token prediction → acoustic token prediction via mask-and-predict. Part of Amphion toolkit.

| Detail | Value |
|--------|-------|
| Repo | [open-mmlab/Amphion](https://github.com/open-mmlab/Amphion/tree/main/models/tts/maskgct) |
| Checkpoints | [amphion/MaskGCT](https://huggingface.co/amphion/MaskGCT) |
| Status | ICLR 2025 |

**Use case:** Speech-domain masked generation. Similar approach to VampNet but for speech.

---

### 13. Kimi-Audio — Audio Foundation Model

Open-source audio foundation model from Moonshot AI. Chunk-wise streaming detokenizer based on flow matching. Audio understanding + generation + conversation.

| Detail | Value |
|--------|-------|
| Repo | [MoonshotAI/Kimi-Audio](https://github.com/MoonshotAI/Kimi-Audio) |

---

## Integration Priority

### Phase 1 — High-Impact, Ready Now

These have open weights, working repos, and fit on A10G.

| Engine | Mutation Type | Effort | Impact |
|--------|--------------|--------|--------|
| **VampNet** | Masked token regeneration | Medium (dependency wrangling) | Highest — fundamentally different mutations |
| **EzAudio** | Native editing + inpainting | Low (clean repo) | High — describe what to change |
| **Stable Audio ControlNet** | Audio-conditioned generation | Low (extends current pipeline) | High — style transfer without destruction |

### Phase 2 — Medium Term

| Engine | Mutation Type | Effort | Impact |
|--------|--------------|--------|--------|
| **AudioX** | Multimodal input (audio/video/image) | Medium | High — cross-modal mutations |
| **AudioLDM 2** | SDEdit (same as current, different model) | Low | Medium — 16kHz limits it |
| **Music2Latent** | Latent backbone | Medium | Medium — enables latent mixing between models |
| **PERI/RAVE** | Personal latent space | Low (already training) | High for your specific use |

### Phase 3 — Speed + Frontier

| Engine | Mutation Type | Effort | Impact |
|--------|--------------|--------|--------|
| **AudioLCM** | 2-step fast generation | Low | Medium — speed for iteration |
| **MAGNeT** | Text-to-audio (no remix) | Low | Low for remix, high for generation |
| **F5-TTS** | Voice infilling | Medium | Niche — speech domain only |
| **MaskGCT** | Masked speech tokens | Medium | Niche — speech domain only |
| **FlashAudio** | 1-step flow matching | Waiting on code | High when available |

---

## Modal Infrastructure

Each engine gets its own Modal function with an engine-specific Docker image. Shared volume for I/O.

```python
# Engine-specific images (heavy dependencies isolated)
vampnet_image = (
    modal.Image.debian_slim(python_version="3.9")
    .apt_install("ffmpeg", "libsndfile1", "git")
    .pip_install("torch==2.4.1", "torchaudio==2.4.1")
    .run_commands(
        "pip install git+https://github.com/hugofloresgarcia/vampnet.git"
    )
)

ezaudio_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install("torch==2.4.1", "diffusers", "transformers")
    # EzAudio-specific deps
)

# Each engine is a separate Modal function
@app.function(image=vampnet_image, gpu="A10G", volumes={VOL: volume})
def remix_vampnet(remix_id, key, prompt, periodic_prompt=7, ...): ...

@app.function(image=ezaudio_image, gpu="A10G", volumes={VOL: volume})
def remix_ezaudio(remix_id, key, prompt, edit_instruction, ...): ...
```

**API route** selects engine:
```typescript
// /api/remix/route.ts
const engine = body.engine || "stable-audio"; // default
const modalCmd = engine === "vampnet"
  ? `modal run remix_engines.py --vampnet --remix-id "${remixId}" ...`
  : engine === "ezaudio"
  ? `modal run remix_engines.py --ezaudio --remix-id "${remixId}" ...`
  : `modal run lora_train.py --remix --remix-id "${remixId}" ...`;
```

**UI** shows engine selector in remix panel with engine-specific controls:
- Stable Audio: strength slider
- VampNet: periodic prompt + codebook mask + temperature
- EzAudio: edit instruction text field
- AudioX: optional image/video input
- PERI: latent manipulation controls

---

## The Two-Stage Pipeline (Experimental)

Chain two engines for double mutation:

```
Input → VampNet (structural mutation) → PERI (sonic coloring) → Output
Input → EzAudio (edit specific elements) → Stable Audio (re-diffuse) → Output
Input → Music2Latent encode → latent interpolation → decode → VampNet → Output
```

This is where it gets genuinely post-generative. The output isn't "generated" — it's a track that's been digested by multiple models and reassembled.

---

## Open Questions

1. **Licensing:** VampNet weights are CC BY-NC-SA. EzAudio and AudioX also NC. Fine for personal/artistic use but limits commercial deployment.
2. **Latency:** VampNet's 36 sampling steps + DAC decode is ~5-10s on GPU. Acceptable for remix but not real-time.
3. **Quality consistency:** Different engines produce different sample rates and channel configs. Need a normalization layer (resample everything to 44.1kHz stereo before returning).
4. **Chaining cost:** Two-stage pipeline = two GPU invocations = 2x Modal cost. Worth it for the results but need to surface cost to user.
5. **VampNet Python 3.9 requirement:** Conflicts with other engines that want 3.11. Separate Modal images solve this.
