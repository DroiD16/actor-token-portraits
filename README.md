# Actor Token Portraits

Actor Token Portraits is a small Foundry VTT module for changing how actor images are shown in the Actors directory.

It is made and tested for Foundry v13.

## Disclaimer

This module was written with the help of artificial intelligence.

I am a professional programmer and I have general software development experience, but JavaScript is not my main area. Because of that, the code was only validated in a fairly superficial way.

The scope of this module is very small, so I do not expect serious problems that would affect Foundry in a major way. Still, it should be used with all of the above in mind.

## Why this module exists

In my games I usually use large and detailed character art for actor portraits. This looks good in the combat carousel and it is also useful when I want to present a character to the players.

The downside is that the same art is then used in the Actors directory. For that place, this kind of image is often not very practical because it is too broad and too detailed.

The token image is usually a much better fit for the directory, but Foundry does not provide a built-in setting for this behavior.

Because of that, I made a very small and focused module that does exactly this one thing.

## How it works

In the Actors directory the module replaces the displayed actor portrait with the actor's token image.

The module uses token artwork for the directory image.

If token artwork is not available, Character artwork will be used as before.

## Settings

The module adds three client settings.

`Use default FoundryVTT Actors render`

This disables the module for your client and restores the normal Foundry behavior in the Actors directory.

`Wildcard token handling`

This setting decides what to show when an actor's token uses wildcard images.

`Always use the first wildcard image`

The module uses the first image from that token's wildcard list.

`Always use a random wildcard image`

The module picks one image at random from that token's wildcard list.

`Use actor portrait instead`

The module ignores the wildcard token images for that actor and shows the default actor portrait instead.

`Respect DnD5e portrait toggle`

This setting only matters in the DnD5e system. When enabled, the module only replaces portraits for actors that have the DnD5e portrait toggle enabled.

In other game systems this setting does nothing and is therefore inactive.

## System note

The module was intended and written as system-agnostic.

That said, I use DnD5e in my own games, so an extra setting was added for that system to allow more precise behavior.