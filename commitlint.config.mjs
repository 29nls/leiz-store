/**
 * commitlint configuration
 *
 * Enforce konvensi commit LEIZ STORE (lihat docs/git-workflow.md).
 * Format: <type>(<scope>): <subject>
 *
 * Tipe inti yang wajib: feat, fix, refactor, docs, test.
 * Tipe tambahan (chore, ci, style, perf, build, revert) diizinkan karena
 * dipakai nyata di history repo (mis. chore(deps) dari Dependabot,
 * ci: untuk perubahan pipeline, chore(release) saat rilis).
 */
export default {
  extends: ["@commitlint/config-conventional"],
  defaultIgnores: true, // abaikan merge commit standar ("Merge branch ...", "Merge pull request ...")
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "refactor",
        "docs",
        "test",
        "chore",
        "ci",
        "style",
        "perf",
        "build",
        "revert",
      ],
    ],
    // Subject boleh memakai huruf apa pun (hindari konflik dengan kata teknis)
    "subject-case": [0],
    // Maksimal 72 karakter pada baris subject
    "header-max-length": [2, "always", 72],
    // Body bebas (boleh lebih panjang)
    "body-max-line-length": [0],
    // Wajib ada type diawal pesan
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
  },
};
