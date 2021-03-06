import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Injectable, Inject } from '@angular/core';

import {
  Observable,
  ConnectableObservable,
  merge,
  of,
  ReplaySubject
} from 'rxjs';
import { map, multicast, switchMap, tap } from 'rxjs/operators';

import { cloneDeep } from 'lodash';
import { Broadcaster, Logger } from 'ngx-base';

import { AUTH_API_URL } from '../shared/auth-api';
import { User } from './user';

/**
 *  Provides user and user list methods to retrieve current or user list details
 *
 *  The UserService should be injected at the root of the application to ensure it is a singleton
 *  getUser and getAllUsers return observables that can be subscribed to for information
 */
@Injectable()
export class UserService {
  /**
   * The currently logged in user - please use currentLoggedInUser instead of subscribing
   * TODO: move this to deprecated
   */
  public loggedInUser: ConnectableObservable<User>;

  /**
   * The current logged in user - should be always populated after login
   */
  public currentLoggedInUser: User = {} as User;

  /**
   * @deprecated since v0.4.4. Use {@link #loggedInUser} instead.
   */
  private userData: User = {} as User;

  /**
   * @deprecated since v0.4.4. No replacement method is provided.
   */
  private allUserData: User[] = [];

  private headers = new HttpHeaders({ 'Content-Type': 'application/json' });
  private userUrl: string;  // URL to web api
  private usersUrl: string;  // URL to web api
  private searchUrl: string;


  constructor(private http: HttpClient,
    private logger: Logger,
    private broadcaster: Broadcaster,
    @Inject(AUTH_API_URL) apiUrl: string
  ) {
    this.userUrl = apiUrl + 'user';
    this.usersUrl = apiUrl + 'users';
    this.searchUrl = apiUrl + 'search';
    // TODO - switch to internal observable that is populated on initialization
    // and only expose currentLoggedInUser publicly
    this.loggedInUser = merge(
      broadcaster.on('loggedin')
        .pipe(map(() => 'loggedIn')),
      broadcaster.on('logout')
        .pipe(map(() => 'loggedOut')),
      broadcaster.on('authenticationError')
        .pipe(map(() => 'authenticationError'))
    ).pipe(
      switchMap((val: any) => {
        // If it's a login event, then we need to retrieve the user's details
        if (val === 'loggedIn') {
          return this.http
            .get(this.userUrl, { headers: this.headers })
            .pipe(
              map((response: {data: User}) => cloneDeep(response.data))
            );
        } else {
          // Otherwise, we clear the user
          return of({});
        }
      }),
      tap((user: any) => {
        this.currentLoggedInUser = user;
        // TODO remove this - ensure nobody is using userData anymore
        this.userData = user;
      }),
      // In order to ensure any future subscribers get the currently user
      // we use a replay subject of size 1
      multicast(() => new ReplaySubject(1))
    ) as ConnectableObservable<User>;
      this.loggedInUser.connect();
  }

  /**
   * Get the User object for a given user id, or null if no user is found
   * @param userId the userId to search for
   */
  getUserByUserId(userId: string): Observable<User> {
    return this.http
      .get(`${this.usersUrl}/${encodeURIComponent(userId)}`, { headers: this.headers })
      .pipe(
        map((response: {data: User}) => response.data)
      );
  }

  /**
   * Get the User object for a given username, or null if no user is found
   * @param username the username to search for
   */
  getUserByUsername(username: string): Observable<User> {
    return this.filterUsersByUsername(username).pipe(map(val => {
      for (let u of val) {
        if (username === u.attributes.username) {
          return u;
        }
      }
      return null;
    }));
  }

  /**
   * Get users by a search string
   */
  getUsersBySearchString(search: string): Observable<User[]> {
    if (search && search !== '') {
      return this.http
        .get(this.searchUrl + '/users?q=' + encodeURIComponent(search), {headers: this.headers})
        .pipe(
          map((response: {data: User[]}) => response.data)
        );
    }
    return of([]);
  }

  /**
   * @deprecated since v0.4.4. Use {@link #loggedInUser} instead.
   */
  getSavedLoggedInUser(): User {
    return this.userData;
  }

  /**
   * @deprecated since v0.4.4. No replacement is provided.
   */
  getLocallySavedUsers(): User[] {
    return this.allUserData;
  }

  /**
   * @deprecated since v0.4.4. Use {@link #loggedInUser} instead.
   * Get currently logged in user
   *
   * @returns Observable<User>
   */
  getUser(): Observable<User> {
    return this.loggedInUser;
  }

  /**
   * @deprecated since v0.4.4. No replacement is provided.
   * Get all users
   *
   * @returns Observable<User[]>
   */
  getAllUsers(): Observable<User[]> {
    return this.http
      .get(this.usersUrl, { headers: this.headers })
      .pipe(
        map((response: {data: User[]}) => response.data),
        // TODO remove this
        tap(val => this.allUserData = val)
      );
  }

  /**
   *
   * Filter users by username
   *
   * @returns Observable<User[]>
   */

  filterUsersByUsername(username: string): Observable<User[]> {
    return this.http
      .get( `${this.usersUrl}?filter[username]=${encodeURIComponent(username)}`, { headers: this.headers })
      .pipe(
        map((response: {data: User[]}) => response.data)
      );
  }

  /**
   * Send email verification link to user.
   */
  sendEmailVerificationLink(): Observable<HttpResponse<any>> {
    const url = this.usersUrl + '/verificationcode';
    return this.http
      .post(url, null, { headers: this.headers, observe: 'response' , responseType: 'text'});
  }

  /**
   * @deprecated since v0.4.4. No replacement is provided.
   *
   */
  resetUser(): void {
    this.userData = {} as User;
  }
}
