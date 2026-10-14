# RANDO 0.2 — uruchomienie z prawdziwą bazą Supabase

## 1. Utwórz darmowy projekt
1. Otwórz https://supabase.com/dashboard i załóż konto.
2. Wybierz **New project**, nazwij go RANDO i poczekaj na utworzenie bazy.
3. W menu **SQL Editor** wybierz **New query**, wklej całą zawartość `supabase.sql` i kliknij **Run**.
4. W **Authentication → Providers → Email** upewnij się, że logowanie przez e-mail jest włączone. Zostaw włączone potwierdzanie adresów e-mail.

## 2. Połącz stronę
1. Otwórz **Project Settings → API** (w niektórych wersjach panelu **Connect → API Keys**).
2. Skopiuj **Project URL** (adres `https://...supabase.co`).
3. Skopiuj **publishable key** (`sb_publishable_...`) albo starszy klucz `anon`.
4. Otwórz `config.js` i zastąp wartości `WPISZ_SUPABASE_URL` i `WPISZ_SUPABASE_PUBLISHABLE_KEY`.
5. **NIGDY** nie wklejaj do strony `service_role`, `secret key`, hasła do bazy ani tokenów administracyjnych.

## 3. Uruchom
1. W VS Code zainstaluj rozszerzenie **Live Server**.
2. Kliknij prawym przyciskiem `index.html` → **Open with Live Server**.
3. Otwórz stronę, kliknij **Zaloguj się → Utwórz konto**.
4. Potwierdź e-mail, zaloguj się, uzupełnij profil i opublikuj moment.
5. Aby przetestować odkrywanie, załóż drugie konto na innym adresie e-mail (np. w innej przeglądarce), uzupełnij profil i opublikuj zdjęcie. Odkrywanie działa tylko, gdy ktoś opublikował moment **dzisiaj (dzień UTC)** i pasuje do filtrów.

## 4. Publikacja za 0 zł
Wgraj pliki folderu `rando-web` do Cloudflare Pages (Direct Upload). Otrzymasz darmowy adres `*.pages.dev`. W Supabase w **Authentication → URL Configuration** ustaw **Site URL** na opublikowany adres i dodaj go do dozwolonych redirect URLs. Nie publikuj kluczy administracyjnych.

## Co działa
- Rejestracja, logowanie, wylogowanie, potwierdzanie e-mail.
- Profil i filtry zapisane w Supabase.
- Publikowanie jednego zdjęcia dziennie do prywatnego bucketu Supabase Storage.
- Jedno odkrycie dziennie: najpierw moment, potem profil.
- Wzajemne zainteresowanie i komunikat MATCH.

## Co jeszcze nie jest gotowe do publicznego uruchomienia
- **Czat**, blokowanie, zgłaszanie i moderacja treści, weryfikacja wieku, polityka prywatności i regulamin. Bez tych elementów **nie zapraszaj obcych użytkowników do otwartej wersji**.
- Dopasowanie w promieniu 50 km (w tej wersji celowo wyłączone, żeby nie udawać działania lokalizacji).
- Odkrywanie według kraju/regionu opiera się na dobrowolnie wpisanych danych, nie na GPS.
- Zdjęcia z prywatnego bucketu otrzymują krótkotrwałe podpisane adresy; odbiorca momentu może zapisać widoczne zdjęcie.
- Zmiana filtrów po przydzieleniu momentu nie zmienia już dzisiejszego odkrycia.
- Nie ma automatycznej moderacji ani ochrony przed wszystkimi nadużyciami.

## Uwaga techniczna
Aplikacja korzysta z biblioteki Supabase z CDN (`esm.sh`) i wymaga internetu. Klucz publishable jest przeznaczony do używania po stronie przeglądarki, a bezpieczeństwo danych zależy od polityk RLS i funkcji SQL. Dzień zmienia się o północy UTC.
