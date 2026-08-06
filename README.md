# Latent-space Attacks for Refusal Evasion in Language Models

**Project page:** https://latentevasion.github.io/ **Paper:** https://arxiv.org/abs/2605.21706 **Code:** https://github.com/pralab/latent-evasion

## Abstract

We recast refusal suppression in language models as a latent-space evasion attack against linear probes. A linear probe separates representations of prompts the model refuses from those it answers, with a decision boundary between refusal and compliance. Prior ablation methods can be read as minimum-confidence evasion: they project the representation onto that boundary, the smallest move that flips the probe's decision, and repeat this erasure at every generated token. Controlled Latent-space Evasion (CLE) instead pushes the hidden representation a chosen distance past the boundary, deep into the compliant region. CLE-P keeps checking and projecting every generated token to the target margin, while CLE-A computes one perturbation at the post-instruction token and reuses it across later positions and intervention layers. The interactive visualizations on this page show how changing the margin moves the prompt in latent space, how CLE-P and CLE-A maintain compliance confidence across generation, and how both CLE variants land deeper in the compliant region than DiM across layers.

## Authors

Giorgio Piras (*, University of Cagliari), Raffaele Mura (*, University of Cagliari), Fabio Brau (*, University of Cagliari), Maura Pintor (University of Cagliari), Luca Oneto (University of Genova), Fabio Roli (University of Genova), Battista Biggio (University of Cagliari).

* Equal contribution.

## BibTeX

```bibtex
@article{piras2026latent,
  title={Latent-space Attacks for Refusal Evasion in Language Models},
  author={Piras, Giorgio and Mura, Raffaele and Brau, Fabio and Pintor, Maura and Oneto, Luca and Roli, Fabio and Biggio, Battista},
  journal={arXiv preprint arXiv:2605.21706},
  year={2026}
}
```

## Acknowledgments

This work was partly supported by the EU-funded Horizon Europe projects Sec4AI4Sec (GA No. 101120393) and CoEvolution (GA No. 101168560), by project FISA-2023-00128, funded under the MUR program "Fondo Italiano per le Scienze Applicate," and by Fondazione di Sardegna under the project "LatentShield: Protecting Large Language Models from Prompt Injection in Latent Space" (CUP: F83C26000350007).
