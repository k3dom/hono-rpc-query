{
  description = "Development environment for hono-rpc-query";
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };
  outputs = {nixpkgs, ...}: let
    # Current nixpkgs no longer supports Intel Darwin.
    eachSupportedSystem = f:
      nixpkgs.lib.genAttrs ["x86_64-linux" "aarch64-linux" "aarch64-darwin"] (
        system:
          f {pkgs = import nixpkgs {inherit system;};}
      );
  in {
    devShells = eachSupportedSystem ({pkgs}: {
      default = pkgs.mkShell {
        packages = with pkgs; [
          # Prefer standalone Corepack over the older copy bundled with Node.
          corepack
          nodejs_24
          alejandra
          statix
          deadnix
          actionlint
          shellcheck
          zizmor
        ];
      };
    });
    formatter = eachSupportedSystem ({pkgs}: pkgs.alejandra);
    checks = eachSupportedSystem ({pkgs}: {
      nix-format = pkgs.runCommand "nix-format" {nativeBuildInputs = [pkgs.alejandra];} ''
        alejandra --check ${./flake.nix}
        touch "$out"
      '';
      nix-lint = pkgs.runCommand "nix-lint" {nativeBuildInputs = [pkgs.statix pkgs.deadnix];} ''
        statix check --config ${./statix.toml} ${./flake.nix}
        deadnix --fail ${./flake.nix}
        touch "$out"
      '';
      workflows = pkgs.runCommand "workflow-lint" {nativeBuildInputs = [pkgs.actionlint pkgs.shellcheck];} ''
        actionlint ${./.github/workflows}/*.yml
        touch "$out"
      '';
    });
  };
}
