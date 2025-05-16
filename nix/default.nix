# nix/default.nix
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs
    pkgs.bun
    pkgs.git
  ];

  shellHook = ''
    echo "🚀 Nix shell started with Bun + Node"
  '';
}